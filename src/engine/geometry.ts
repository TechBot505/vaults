import type { Action, CameraDef, Dir, GuardDef, KeyColor, LaserDef, Pt, VaultDef } from "./types";

/** Direction helpers. Screen coordinates: y grows downward, so N is y-1. */
export const DELTA: Record<Dir, Pt> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

export const ACTION_DIR: Partial<Record<Action, Dir>> = { U: "N", R: "E", D: "S", L: "W" };

export const DIR_ANGLE: Record<Dir, number> = { N: -90, E: 0, S: 90, W: 180 };

export function perp(d: Dir): Pt {
  const v = DELTA[d];
  return { x: -v.y, y: v.x };
}

export function dirBetween(a: Pt, b: Pt): Dir | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === -1) return "N";
  if (dx === 1 && dy === 0) return "E";
  if (dx === 0 && dy === 1) return "S";
  if (dx === -1 && dy === 0) return "W";
  return null;
}

export const samePt = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;

/** Every cell on a laser beam, a..b inclusive. */
export function laserCells(l: LaserDef): Pt[] {
  const cells: Pt[] = [];
  if (l.a.y === l.b.y) {
    const [x0, x1] = l.a.x <= l.b.x ? [l.a.x, l.b.x] : [l.b.x, l.a.x];
    for (let x = x0; x <= x1; x++) cells.push({ x, y: l.a.y });
  } else {
    const [y0, y1] = l.a.y <= l.b.y ? [l.a.y, l.b.y] : [l.b.y, l.a.y];
    for (let y = y0; y <= y1; y++) cells.push({ x: l.a.x, y });
  }
  return cells;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

export const guardStep = (g: GuardDef, t: number) => g.route[mod(t, g.route.length)];
export const cameraDir = (c: CameraDef, t: number) => c.dirs[mod(t, c.dirs.length)];
export const laserPhaseOn = (l: LaserDef, t: number) => l.pattern[mod(t, l.pattern.length)] === "1";

/**
 * A compiled vault: lookup tables and a line-of-sight cache so the engine,
 * renderer and solver all answer "who can see what" in O(1) after warmup.
 */
export class Level {
  readonly def: VaultDef;
  readonly w: number;
  readonly h: number;
  /** tile index → blocks movement (wall, void) */
  readonly solid: Uint8Array;
  /** tile index → blocks sight (wall, void, door) */
  readonly opaque: Uint8Array;
  /** tile index → door color */
  readonly doorAt = new Map<number, KeyColor>();
  readonly keyAt = new Map<number, KeyColor>();
  readonly lootAt = new Map<number, number>();
  /** tile index → laser indices crossing it */
  readonly laserAt = new Map<number, number[]>();
  private sightCache = new Map<number, number[]>();

  constructor(def: VaultDef) {
    this.def = def;
    this.w = def.w;
    this.h = def.h;
    const n = def.w * def.h;
    this.solid = new Uint8Array(n);
    this.opaque = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const ch = def.tiles[i] ?? " ";
      const blocks = ch !== ".";
      this.solid[i] = blocks ? 1 : 0;
      this.opaque[i] = blocks ? 1 : 0;
    }
    for (const d of def.doors) {
      const i = this.idx(d.x, d.y);
      this.doorAt.set(i, d.color);
      this.opaque[i] = 1;
    }
    for (const k of def.keys) this.keyAt.set(this.idx(k.x, k.y), k.color);
    def.loot.forEach((l, i) => this.lootAt.set(this.idx(l.x, l.y), i));
    def.lasers.forEach((l, li) => {
      for (const c of laserCells(l)) {
        const i = this.idx(c.x, c.y);
        const arr = this.laserAt.get(i) ?? [];
        arr.push(li);
        this.laserAt.set(i, arr);
      }
    });
  }

  idx(x: number, y: number) {
    return y * this.w + x;
  }

  inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  isSolid(x: number, y: number) {
    return !this.inBounds(x, y) || this.solid[this.idx(x, y)] === 1;
  }

  isOpaque(x: number, y: number) {
    return !this.inBounds(x, y) || this.opaque[this.idx(x, y)] === 1;
  }

  /**
   * Straight line of sight between two tiles (Bresenham, endpoints excluded).
   * A diagonal step squeezing between two opaque corners is blocked, so you
   * can never be seen (or see) through the crack where two walls touch.
   */
  clearLine(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      if (x === x1 && y === y1) return true;
      const px = x;
      const py = y;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
      if (px !== x && py !== y && this.isOpaque(x, py) && this.isOpaque(px, y)) return false;
      if (x === x1 && y === y1) return true;
      if (this.isOpaque(x, y)) return false;
    }
  }

  /**
   * Tiles watched by a sight source at (x,y) facing d with range r.
   * The cone widens by one tile on each side every two tiles:
   *   distance 1: front tile, 2–3: ±1, 4–5: ±2, 6: ±3.
   * A tile is watched if it's walkable-or-door-free floor and has clear sight.
   */
  sight(x: number, y: number, d: Dir, r: number): number[] {
    const key = ((y * this.w + x) * 4 + "NESW".indexOf(d)) * 8 + r;
    const hit = this.sightCache.get(key);
    if (hit) return hit;
    const out: number[] = [];
    const f = DELTA[d];
    const p = perp(d);
    for (let k = 1; k <= r; k++) {
      const spread = Math.floor(k / 2);
      for (let o = -spread; o <= spread; o++) {
        const tx = x + f.x * k + p.x * o;
        const ty = y + f.y * k + p.y * o;
        if (!this.inBounds(tx, ty)) continue;
        if (this.isOpaque(tx, ty)) continue;
        if (!this.clearLine(x, y, tx, ty)) continue;
        out.push(this.idx(tx, ty));
      }
    }
    this.sightCache.set(key, out);
    return out;
  }
}

/** Least common multiple of all repeating cycles in the vault (capped). */
export function worldPeriod(def: VaultDef, cap = 100000): number {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  let p = 1;
  const lens = [...def.guards.map((g) => g.route.length), ...def.cameras.map((c) => c.dirs.length), ...def.lasers.map((l) => l.pattern.length)];
  for (const n of lens) {
    if (n <= 0) continue;
    p = (p / gcd(p, n)) * n;
    if (p > cap) return cap;
  }
  return p;
}

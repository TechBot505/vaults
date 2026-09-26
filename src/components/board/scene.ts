import { Level, DELTA, laserCells } from "@/engine/geometry";
import { watchedBy, worldAt, type WorldSnapshot } from "@/engine/game";
import type { Body, GameState, Pt } from "@/engine/types";

/** Everything the board needs to draw one moment of a heist. */
export interface Scene {
  t: number;
  world: WorldSnapshot;
  /** tile index → 1 guard / 2 camera / 3 both */
  watched: Uint8Array;
  /** next turn's watched tiles (forecast) */
  next: Uint8Array;
  nextWorld: WorldSnapshot;
  thief: Pt | null;
  bodies: Body[];
  lootTaken: boolean[];
  keys: string[];
}

function watchMap(level: Level, w: WorldSnapshot): Uint8Array {
  const m = new Uint8Array(level.w * level.h);
  for (const s of watchedBy(level, w)) {
    const bit = s.kind === "guard" ? 1 : 2;
    for (const i of s.tiles) m[i] |= bit;
  }
  return m;
}

export function sceneFor(level: Level, state: GameState | null, t = state?.t ?? 0): Scene {
  const down = state?.down ?? [];
  const empUntil = state?.empUntil ?? -1;
  const world = worldAt(level, t, down, empUntil);
  const nextWorld = worldAt(level, t + 1, down, empUntil);
  return {
    t,
    world,
    watched: watchMap(level, world),
    next: watchMap(level, nextWorld),
    nextWorld,
    thief: state ? state.pos : null,
    bodies: state?.bodies ?? [],
    lootTaken: state?.loot ?? level.def.loot.map(() => false),
    keys: state?.keys ?? [],
  };
}

/** Wall outline: only the edges where a wall meets a non-wall tile. */
export function wallOutline(level: Level): string {
  const { w, h } = level;
  const isWall = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && level.def.tiles[y * w + x] === "#";
  const segs: string[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isWall(x, y)) continue;
      if (!isWall(x, y - 1)) segs.push(`M${x} ${y}h1`);
      if (!isWall(x, y + 1)) segs.push(`M${x} ${y + 1}h1`);
      if (!isWall(x - 1, y)) segs.push(`M${x} ${y}v1`);
      if (!isWall(x + 1, y)) segs.push(`M${x + 1} ${y}v1`);
    }
  }
  return segs.join("");
}

/** Filled wall mass as one path (cheap to render, crisp at any size). */
export function wallFill(level: Level): string {
  const { w, h } = level;
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (level.def.tiles[y * w + x] !== "#") {
        x++;
        continue;
      }
      const start = x;
      while (x < w && level.def.tiles[y * w + x] === "#") x++;
      out.push(`M${start} ${y}h${x - start}v1h${-(x - start)}z`);
    }
  }
  return out.join("");
}

export function floorFill(level: Level): string {
  const { w, h } = level;
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (level.def.tiles[y * w + x] !== ".") {
        x++;
        continue;
      }
      const start = x;
      while (x < w && level.def.tiles[y * w + x] === ".") x++;
      out.push(`M${start} ${y}h${x - start}v1h${-(x - start)}z`);
    }
  }
  return out.join("");
}

/** A door bar spans the passage: horizontal when there are walls to its left and right. */
export function doorHorizontal(level: Level, p: Pt): boolean {
  return level.isSolid(p.x - 1, p.y) && level.isSolid(p.x + 1, p.y);
}

/** Single-cell lasers: pick the axis that has walls at both ends. */
export function laserAxis(level: Level, l: { a: Pt; b: Pt }): "h" | "v" {
  if (l.a.y === l.b.y && l.a.x !== l.b.x) return "h";
  if (l.a.x === l.b.x && l.a.y !== l.b.y) return "v";
  return level.isSolid(l.a.x - 1, l.a.y) && level.isSolid(l.a.x + 1, l.a.y) ? "h" : "v";
}

/** Laser beam from wall to wall, in board units. */
export function laserGeom(level: Level, l: { a: Pt; b: Pt }): { x1: number; y1: number; x2: number; y2: number; axis: "h" | "v" } {
  const cells = laserCells({ id: "", a: l.a, b: l.b, pattern: "1" });
  const first = cells[0];
  const last = cells[cells.length - 1];
  const axis = laserAxis(level, l);
  if (axis === "h") return { x1: first.x, y1: first.y + 0.5, x2: last.x + 1, y2: first.y + 0.5, axis };
  return { x1: first.x + 0.5, y1: first.y, x2: first.x + 0.5, y2: last.y + 1, axis };
}

export const dirVec = DELTA;

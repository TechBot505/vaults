import { DELTA, Level } from "./geometry";
import { exactPeriod, newGame, run, step } from "./game";
import type { Action, GameState, VaultDef } from "./types";

/**
 * The Machine: an A* search over every situation a thief can be in.
 *
 * Because the world repeats with period P (the least common multiple of all
 * patrol, camera and laser cycles), a situation is fully described by
 * (position, time mod P, bag, knocked-out guards, EMP state). The heuristic is
 * the walking distance to the remaining loot and back out, ignoring every
 * guard, camera and laser, so it never overestimates and the first escape the
 * Machine finds is the shortest one possible. It reuses the real `step`, so it
 * can never disagree with the rules.
 */

export type SolveResult =
  | { status: "solved"; moves: string; turns: number; explored: number; lowerBound: number }
  | { status: "impossible"; explored: number }
  | { status: "gave-up"; explored: number };

const ORDER: Action[] = ["U", "R", "D", "L", "W", "E"];

/** Walking distance from every tile to a target, ignoring everything but walls. */
function distanceField(level: Level, tx: number, ty: number): Int32Array {
  const n = level.w * level.h;
  const dist = new Int32Array(n).fill(-1);
  const q = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const start = level.idx(tx, ty);
  dist[start] = 0;
  q[tail++] = start;
  while (head < tail) {
    const cur = q[head++];
    const cx = cur % level.w;
    const cy = (cur / level.w) | 0;
    for (const d of ["N", "E", "S", "W"] as const) {
      const nx = cx + DELTA[d].x;
      const ny = cy + DELTA[d].y;
      if (level.isSolid(nx, ny)) continue;
      const ni = level.idx(nx, ny);
      if (dist[ni] !== -1) continue;
      dist[ni] = dist[cur] + 1;
      q[tail++] = ni;
    }
  }
  return dist;
}

/** Binary min-heap keyed by (f, -g). */
class Heap {
  private items: number[] = [];
  private f: number[] = [];
  private g: number[] = [];
  get size() {
    return this.items.length;
  }
  push(item: number, f: number, g: number) {
    this.items.push(item);
    this.f.push(f);
    this.g.push(g);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(i, p)) {
        this.swap(i, p);
        i = p;
      } else break;
    }
  }
  pop(): number {
    const top = this.items[0];
    const last = this.items.length - 1;
    this.swap(0, last);
    this.items.pop();
    this.f.pop();
    this.g.pop();
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < this.items.length && this.less(l, m)) m = l;
      if (r < this.items.length && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
  private less(a: number, b: number) {
    return this.f[a] < this.f[b] || (this.f[a] === this.f[b] && this.g[a] > this.g[b]);
  }
  private swap(a: number, b: number) {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.f[a], this.f[b]] = [this.f[b], this.f[a]];
    [this.g[a], this.g[b]] = [this.g[b], this.g[a]];
  }
}

export interface SolveOptions {
  /** stop after exploring this many situations */
  maxStates?: number;
  /** progress callback (every ~4000 states) */
  onProgress?: (explored: number, bestF: number) => void;
  /** cooperative cancel */
  shouldStop?: () => boolean;
}

export function solve(def: VaultDef, opts: SolveOptions = {}): SolveResult {
  const maxStates = opts.maxStates ?? 400_000;
  const level = new Level(def);
  const period = exactPeriod(def, 5000);
  const toExit = distanceField(level, def.entry.x, def.entry.y);
  const toLoot = def.loot.map((l) => distanceField(level, l.x, l.y));

  // admissible: must still reach each missing loot and then the exit
  const h = (s: GameState): number => {
    const pi = level.idx(s.pos.x, s.pos.y);
    let best = 0;
    let anyMissing = false;
    for (let i = 0; i < def.loot.length; i++) {
      if (s.loot[i]) continue;
      anyMissing = true;
      const a = toLoot[i][pi];
      const l = def.loot[i];
      const b = toExit[level.idx(l.x, l.y)];
      if (a < 0 || b < 0) return Infinity;
      best = Math.max(best, a + b);
    }
    if (!anyMissing) {
      const d = toExit[pi];
      return d < 0 ? Infinity : d;
    }
    return best;
  };

  const keyOf = (s: GameState): string => {
    let loot = 0;
    for (let i = 0; i < s.loot.length; i++) if (s.loot[i]) loot |= 1 << i;
    const keys = s.keys.length ? [...s.keys].sort().join("") : "";
    const bodies = s.bodies.length ? s.bodies.map((b) => `${b.guard}@${b.x}.${b.y}`).sort().join(";") : "";
    const tk = period === null ? s.t : s.t % period;
    const empRem = Math.max(0, s.empUntil - s.t);
    return `${s.pos.x},${s.pos.y}|${tk}|${loot}|${keys}|${bodies}|${s.empLeft}.${empRem}`;
  };

  const start = newGame(def);
  const h0 = h(start);
  if (!Number.isFinite(h0)) return { status: "impossible", explored: 1 };

  const states: GameState[] = [start];
  const parent: number[] = [-1];
  const via: string[] = [""];
  const bestG = new Map<string, number>([[keyOf(start), 0]]);
  const heap = new Heap();
  heap.push(0, h0, 0);
  let explored = 0;

  while (heap.size) {
    if (states.length > maxStates) return { status: "gave-up", explored };
    if (opts.shouldStop?.()) return { status: "gave-up", explored };
    const curIdx = heap.pop();
    const cur = states[curIdx];
    if (cur.status === "cracked") {
      // goals are queued with h = 0, so the first one popped is the shortest heist
      let moves = "";
      let i = curIdx;
      while (i > 0) {
        moves = via[i] + moves;
        i = parent[i];
      }
      const check = run(level, moves);
      if (check.status !== "cracked") return { status: "gave-up", explored };
      return { status: "solved", moves, turns: moves.length, explored, lowerBound: h0 };
    }
    // skip stale entries superseded by a cheaper path to the same situation
    if ((bestG.get(keyOf(cur)) ?? Infinity) < cur.t) continue;
    explored++;
    if (explored % 4000 === 0) opts.onProgress?.(explored, cur.t + h(cur));
    for (const a of ORDER) {
      if (a === "E" && cur.empLeft <= 0) continue;
      const r = step(level, cur, a);
      if (!r.ok) continue;
      const s = r.state;
      if (s.status === "caught") continue;
      if (s.status === "cracked") {
        states.push(s);
        parent.push(curIdx);
        via.push(a);
        heap.push(states.length - 1, s.t, s.t);
        continue;
      }
      const hs = h(s);
      if (!Number.isFinite(hs)) continue;
      const k = keyOf(s);
      const prev = bestG.get(k);
      if (prev !== undefined && prev <= s.t) continue;
      bestG.set(k, s.t);
      states.push(s);
      parent.push(curIdx);
      via.push(a);
      heap.push(states.length - 1, s.t + hs, s.t);
    }
  }
  return { status: "impossible", explored };
}

/**
 * Security rating (1–5 locks). Combines how long the shortest heist is, how
 * much longer it is than simply walking to the loot (the detours the security
 * forces on you), and how much searching the Machine needed.
 */
export function securityRating(turns: number, explored: number, lowerBound: number): { locks: number; label: string } {
  const detour = lowerBound > 0 ? turns / lowerBound : 1;
  const score = Math.log10(Math.max(10, explored)) + (detour - 1) * 2.2 + turns / 40;
  const locks = score < 2.6 ? 1 : score < 3.6 ? 2 : score < 4.6 ? 3 : score < 5.6 ? 4 : 5;
  const label = ["", "petty", "guarded", "fortified", "vault-grade", "unbreakable?"][locks];
  return { locks, label };
}

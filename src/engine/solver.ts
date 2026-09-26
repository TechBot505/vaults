import { Level } from "./geometry";
import { newGame, run, step } from "./game";
import type { Action, GameState, VaultDef } from "./types";

/**
 * The Machine: a breadth-first search over every reachable situation.
 *
 * Because the world repeats with period P (the least common multiple of all
 * patrol, camera and laser cycles), a situation is fully described by
 * (position, time mod P, bag, knocked-out guards, EMP charge). BFS visits each
 * situation at its earliest possible turn, so the first escape it finds is the
 * shortest possible heist. It reuses the real `step` function, so the Machine
 * can never disagree with the rules.
 */

export type SolveResult =
  | { status: "solved"; moves: string; turns: number; explored: number }
  | { status: "impossible"; explored: number }
  | { status: "gave-up"; explored: number };

const ORDER: Action[] = ["U", "R", "D", "L", "W", "E"];

function exactPeriod(def: VaultDef, cap: number): number | null {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  let p = 1;
  const lens = [...def.guards.map((g) => g.route.length), ...def.cameras.map((c) => c.dirs.length), ...def.lasers.map((l) => l.pattern.length)];
  for (const n of lens) {
    p = (p / gcd(p, n)) * n;
    if (p > cap) return null;
  }
  return p;
}

function keyOf(s: GameState, level: Level, period: number | null): string {
  let loot = 0;
  s.loot.forEach((v, i) => {
    if (v) loot |= 1 << i;
  });
  const keys = s.keys.length ? [...s.keys].sort().join("") : "";
  // a knocked-out guard is identified by where their body lies
  const bodies = s.bodies.length ? s.bodies.map((b) => `${b.guard}@${b.x}.${b.y}`).sort().join(";") : "";
  const tk = period === null ? s.t : s.t % period;
  const empRem = Math.max(0, s.empUntil - s.t);
  return `${s.pos.x},${s.pos.y}|${tk}|${loot}|${keys}|${bodies}|${s.empLeft}.${empRem}`;
}

export interface SolveOptions {
  /** stop after exploring this many situations */
  maxStates?: number;
  /** optional progress callback (every ~5000 states) */
  onProgress?: (explored: number, depth: number) => void;
  /** cooperative cancel */
  shouldStop?: () => boolean;
}

export function solve(def: VaultDef, opts: SolveOptions = {}): SolveResult {
  const maxStates = opts.maxStates ?? 400_000;
  const level = new Level(def);
  const period = exactPeriod(def, 5000);
  const start = newGame(def);

  // parallel arrays: parent pointer + action that led here
  const states: GameState[] = [start];
  const parent: number[] = [-1];
  const via: string[] = [""];
  const seen = new Set<string>([keyOf(start, level, period)]);
  let head = 0;

  while (head < states.length) {
    if (states.length > maxStates) return { status: "gave-up", explored: states.length };
    if (opts.shouldStop?.()) return { status: "gave-up", explored: states.length };
    const cur = states[head];
    const curIdx = head++;
    if (curIdx % 5000 === 0) opts.onProgress?.(states.length, cur.t);
    for (const a of ORDER) {
      if (a === "E" && cur.empLeft <= 0) continue;
      const r = step(level, cur, a);
      if (!r.ok) continue;
      const s = r.state;
      if (s.status === "caught") continue;
      if (s.status === "cracked") {
        let moves = a;
        let i = curIdx;
        while (i > 0) {
          moves = via[i] + moves;
          i = parent[i];
        }
        // belt and braces: the answer must replay under the real rules
        const check = run(level, moves);
        if (check.status !== "cracked") return { status: "gave-up", explored: states.length };
        return { status: "solved", moves, turns: moves.length, explored: states.length };
      }
      const k = keyOf(s, level, period);
      if (seen.has(k)) continue;
      seen.add(k);
      states.push(s);
      parent.push(curIdx);
      via.push(a);
    }
  }
  return { status: "impossible", explored: states.length };
}

/**
 * Security rating (1–5 locks) from how long the shortest heist is and how
 * much of the building the Machine had to search to find it.
 */
export function securityRating(turns: number, explored: number): { locks: number; label: string } {
  const score = Math.log10(Math.max(10, explored)) * 1.1 + turns / 18;
  const locks = score < 3.2 ? 1 : score < 4.2 ? 2 : score < 5.2 ? 3 : score < 6.2 ? 4 : 5;
  const label = ["", "petty", "guarded", "fortified", "vault-grade", "unbreakable?"][locks];
  return { locks, label };
}

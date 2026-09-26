import { DELTA, dirBetween } from "./geometry";
import type { CameraDef, Dir, DoorDef, GuardDef, KeyDef, LaserDef, PatrolStep, Pt, VaultDef } from "./types";

/** A patrol waypoint. The guard walks the shortest path between waypoints. */
export interface Waypoint extends Pt {
  /** turns to stand here after arriving */
  wait?: number;
  /** directions to look while waiting (cycled); defaults to the arrival direction */
  look?: Dir[];
}

/** Shortest walkable path between two tiles (4-directional, deterministic tie-break N,E,S,W). */
export function shortestPath(walkable: (x: number, y: number) => boolean, w: number, h: number, from: Pt, to: Pt): Pt[] | null {
  if (from.x === to.x && from.y === to.y) return [from];
  const idx = (x: number, y: number) => y * w + x;
  const prev = new Int32Array(w * h).fill(-1);
  const seen = new Uint8Array(w * h);
  const q: number[] = [idx(from.x, from.y)];
  seen[q[0]] = 1;
  const order: Dir[] = ["N", "E", "S", "W"];
  for (let head = 0; head < q.length; head++) {
    const cur = q[head];
    const cx = cur % w;
    const cy = (cur / w) | 0;
    for (const d of order) {
      const nx = cx + DELTA[d].x;
      const ny = cy + DELTA[d].y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = idx(nx, ny);
      if (seen[ni] || !walkable(nx, ny)) continue;
      seen[ni] = 1;
      prev[ni] = cur;
      if (nx === to.x && ny === to.y) {
        const path: Pt[] = [];
        let p = ni;
        while (p !== -1) {
          path.push({ x: p % w, y: (p / w) | 0 });
          p = prev[p];
        }
        return path.reverse();
      }
      q.push(ni);
    }
  }
  return null;
}

/**
 * Turn waypoints into a per-turn patrol. `loop` walks W0→…→Wn→W0;
 * `pingpong` walks there and back along the same waypoints.
 */
export function makeRoute(
  waypoints: Waypoint[],
  walkable: (x: number, y: number) => boolean,
  w: number,
  h: number,
  mode: "loop" | "pingpong" = "loop",
  initialDir: Dir = "S",
): PatrolStep[] | null {
  if (waypoints.length === 0) return null;
  const wps = mode === "pingpong" && waypoints.length > 2 ? [...waypoints, ...waypoints.slice(1, -1).reverse()] : waypoints;
  const steps: PatrolStep[] = [];
  // a guard always faces the way it's walking; it starts facing its first move
  let facing: Dir = initialDir;
  const pushWait = (wp: Waypoint) => {
    const n = wp.wait ?? 0;
    for (let i = 0; i < n; i++) {
      const d = wp.look && wp.look.length ? wp.look[i % wp.look.length] : facing;
      steps.push({ x: wp.x, y: wp.y, d });
    }
    if (wp.look && wp.look.length && n > 0) facing = wp.look[(n - 1) % wp.look.length];
  };
  if (wps.length === 1) {
    const wp = wps[0];
    const look = wp.look && wp.look.length ? wp.look : [initialDir];
    const n = Math.max(1, wp.wait ?? look.length);
    for (let i = 0; i < n; i++) steps.push({ x: wp.x, y: wp.y, d: look[i % look.length] });
    return steps;
  }
  for (let i = 0; i < wps.length; i++) {
    const a = wps[i];
    const b = wps[(i + 1) % wps.length];
    const path = shortestPath(walkable, w, h, a, b);
    if (!path) return null;
    if (i === 0) {
      const d0 = path.length > 1 ? dirBetween(path[0], path[1]) : null;
      if (d0) facing = d0;
      steps.push({ x: a.x, y: a.y, d: facing });
      pushWait(a);
    }
    for (let j = 1; j < path.length; j++) {
      const d = dirBetween(path[j - 1], path[j]);
      if (d) facing = d;
      // the final tile of the whole loop is the start tile: don't duplicate it
      if (i === wps.length - 1 && j === path.length - 1) break;
      steps.push({ x: path[j].x, y: path[j].y, d: facing });
    }
    if (i < wps.length - 1) pushWait(b);
  }
  return steps;
}

export interface AsciiExtras {
  guards?: { id: string; waypoints: Waypoint[]; mode?: "loop" | "pingpong"; range?: number; armored?: boolean; dir?: Dir }[];
  cameras?: { id: string; x: number; y: number; dirs: Dir[]; range?: number }[];
  lasers?: { id: string; a: Pt; b: Pt; pattern: string }[];
  emp?: number;
  maxTurns?: number;
}

/**
 * Build a vault from an ASCII map (tests and hand-made heists):
 *   #  wall      .  floor     (space) outside
 *   E  entrance  $  loot
 *   r b g  keycards (red, blue, gold)   R B G  doors
 */
export function fromAscii(rows: string[], extras: AsciiExtras = {}): VaultDef {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  let tiles = "";
  let entry: Pt = { x: 0, y: 0 };
  const loot: Pt[] = [];
  const keys: KeyDef[] = [];
  const doors: DoorDef[] = [];
  const colors = { r: "red", b: "blue", g: "gold" } as const;
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? " ";
      let t = ".";
      if (ch === "#") t = "#";
      else if (ch === " ") t = " ";
      else if (ch === "E") entry = { x, y };
      else if (ch === "$") loot.push({ x, y });
      else if (ch === "r" || ch === "b" || ch === "g") keys.push({ x, y, color: colors[ch] });
      else if (ch === "R" || ch === "B" || ch === "G") doors.push({ x, y, color: colors[ch.toLowerCase() as "r" | "b" | "g"] });
      tiles += t;
    }
  });
  const doorSet = new Set(doors.map((d) => `${d.x},${d.y}`));
  const walkable = (x: number, y: number) => tiles[y * w + x] === "." && !doorSet.has(`${x},${y}`);
  const guards: GuardDef[] = (extras.guards ?? []).map((g) => {
    const route = makeRoute(g.waypoints, walkable, w, h, g.mode ?? "loop", g.dir ?? "S");
    if (!route) throw new Error(`guard ${g.id}: no path between waypoints`);
    return { id: g.id, route, range: g.range ?? 3, armored: g.armored ?? false };
  });
  const cameras: CameraDef[] = (extras.cameras ?? []).map((c) => ({ id: c.id, x: c.x, y: c.y, dirs: c.dirs, range: c.range ?? 4 }));
  const lasers: LaserDef[] = extras.lasers ?? [];
  return { v: 1, w, h, tiles, entry, loot, doors, keys, guards, cameras, lasers, emp: extras.emp ?? 0, maxTurns: extras.maxTurns ?? 0 };
}

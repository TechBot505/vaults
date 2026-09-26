import { ACTION_DIR, DELTA, Level, cameraDir, guardStep, laserPhaseOn, samePt } from "./geometry";
import type { Action, Body, CaughtBy, GameEvent, GameState, Pt, StepResult, VaultDef } from "./types";

/**
 * The rules, in the exact order they're applied each turn:
 *
 *  1. ACT       Move one tile (U/D/L/R), wait (W) or fire an EMP (E).
 *               Walls and locked doors can't be entered (the move is refused,
 *               no turn passes). A door opens for you if you hold its key.
 *  2. TAKEDOWN  Stepping onto a guard knocks them out and leaves a body.
 *               Armored guards can't be knocked out: stepping onto one = caught.
 *  3. PICK UP   Loot and keycards on your tile go in your bag.
 *  4. ESCAPE    Holding all the loot while standing on the entrance = cracked.
 *  5. TICK      Time advances: guards take their next patrol step, cameras
 *               turn, lasers switch. A guard stepping onto you = caught.
 *  6. DETECT    You're caught if any guard or camera can see you, or you stand
 *               in a live laser. If a guard or camera can see a body, the alarm
 *               goes off: caught. (Cameras and lasers are offline during an EMP.)
 *  7. CLOCK     Out of turns = caught.
 */

export function newGame(def: VaultDef): GameState {
  return {
    t: 0,
    pos: { ...def.entry },
    loot: def.loot.map(() => false),
    keys: [],
    down: [],
    bodies: [],
    empLeft: def.emp,
    empUntil: -1,
    status: "playing",
    moves: "",
  };
}

export interface WorldGuard {
  id: string;
  x: number;
  y: number;
  d: GuardDefDir;
  down: boolean;
  armored: boolean;
  range: number;
}
type GuardDefDir = "N" | "E" | "S" | "W";

export interface WorldSnapshot {
  t: number;
  guards: WorldGuard[];
  cameras: { id: string; x: number; y: number; d: GuardDefDir; range: number; off: boolean }[];
  lasers: { id: string; on: boolean }[];
  empActive: boolean;
}

/** Where everything is at time t, given what the thief has done so far. */
export function worldAt(level: Level, t: number, down: string[], empUntil: number): WorldSnapshot {
  const def = level.def;
  const empActive = t <= empUntil;
  return {
    t,
    empActive,
    guards: def.guards.map((g) => {
      const s = guardStep(g, t);
      return { id: g.id, x: s.x, y: s.y, d: s.d, down: down.includes(g.id), armored: g.armored, range: g.range };
    }),
    cameras: def.cameras.map((c) => ({ id: c.id, x: c.x, y: c.y, d: cameraDir(c, t), range: c.range, off: empActive })),
    lasers: def.lasers.map((l) => ({ id: l.id, on: !empActive && laserPhaseOn(l, t) })),
  };
}

/** Tile indices watched by each active sight source at this moment. */
export function watchedBy(level: Level, w: WorldSnapshot): { id: string; kind: "guard" | "camera"; tiles: number[]; x: number; y: number }[] {
  const out: { id: string; kind: "guard" | "camera"; tiles: number[]; x: number; y: number }[] = [];
  for (const g of w.guards) {
    if (g.down) continue;
    out.push({ id: g.id, kind: "guard", tiles: level.sight(g.x, g.y, g.d, g.range), x: g.x, y: g.y });
  }
  for (const c of w.cameras) {
    if (c.off) continue;
    out.push({ id: c.id, kind: "camera", tiles: level.sight(c.x, c.y, c.d, c.range), x: c.x, y: c.y });
  }
  return out;
}

/**
 * A cached, index-based view of one moment, used by the rules and the solver:
 * which tile each active guard stands on, and the first sight source (in
 * guard-then-camera order) that watches each tile. Rendering uses worldAt.
 */
interface Snap {
  /** tile → active guard ids standing there (definition order) */
  guardsAt: Map<number, string[]>;
  /** tile → 1 + index into srcIds of the first source that sees it (0 = unseen) */
  seen: Uint16Array;
  srcIds: string[];
  srcKinds: ("guard" | "camera")[];
  laserOn: boolean[];
  armored: Set<string>;
}

const snapCaches = new WeakMap<Level, { period: number | null; map: Map<string, Snap> }>();

export function exactPeriod(def: VaultDef, cap = 5000): number | null {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  let p = 1;
  const lens = [...def.guards.map((g) => g.route.length), ...def.cameras.map((c) => c.dirs.length), ...def.lasers.map((l) => l.pattern.length)];
  for (const n of lens) {
    p = (p / gcd(p, n)) * n;
    if (p > cap) return null;
  }
  return p;
}

function snapAt(level: Level, t: number, down: string[], empUntil: number): Snap {
  let cache = snapCaches.get(level);
  if (!cache) {
    cache = { period: exactPeriod(level.def), map: new Map() };
    snapCaches.set(level, cache);
  }
  const empActive = t <= empUntil;
  const tk = cache.period === null ? t : t % cache.period;
  const key = `${tk}|${down.length ? [...down].sort().join(",") : ""}|${empActive ? 1 : 0}`;
  const hit = cache.map.get(key);
  if (hit) return hit;
  const w = worldAt(level, t, down, empUntil);
  const guardsAt = new Map<number, string[]>();
  for (const g of w.guards) {
    if (g.down) continue;
    const i = level.idx(g.x, g.y);
    const list = guardsAt.get(i);
    if (list) list.push(g.id);
    else guardsAt.set(i, [g.id]);
  }
  const seen = new Uint16Array(level.w * level.h);
  const srcIds: string[] = [];
  const srcKinds: ("guard" | "camera")[] = [];
  for (const src of watchedBy(level, w)) {
    srcIds.push(src.id);
    srcKinds.push(src.kind);
    const n = srcIds.length;
    for (const i of src.tiles) if (seen[i] === 0) seen[i] = n;
  }
  const snap: Snap = {
    guardsAt,
    seen,
    srcIds,
    srcKinds,
    laserOn: w.lasers.map((l) => l.on),
    armored: new Set(level.def.guards.filter((g) => g.armored).map((g) => g.id)),
  };
  if (cache.map.size > 50000) cache.map.clear();
  cache.map.set(key, snap);
  return snap;
}

function detectSnap(level: Level, s: Snap, pos: Pt, bodies: Body[]): CaughtBy | null {
  const pi = level.idx(pos.x, pos.y);
  const on = s.guardsAt.get(pi);
  if (on) return { kind: "guard", id: on[0] };
  const src = s.seen[pi];
  if (src) return { kind: s.srcKinds[src - 1], id: s.srcIds[src - 1] };
  const lasers = level.laserAt.get(pi);
  if (lasers) {
    for (const li of lasers) if (s.laserOn[li]) return { kind: "laser", id: level.def.lasers[li].id };
  }
  for (const b of bodies) {
    const bi = level.idx(b.x, b.y);
    const stumble = s.guardsAt.get(bi);
    if (stumble) return { kind: "body", id: b.guard, seenBy: stumble[0] };
    const bs = s.seen[bi];
    if (bs) return { kind: "body", id: b.guard, seenBy: s.srcIds[bs - 1] };
  }
  return null;
}

/** Detection check for the thief standing at `pos` at time t. */
export function detect(level: Level, w: WorldSnapshot, pos: Pt, bodies: Body[]): CaughtBy | null {
  const down = w.guards.filter((g) => g.down).map((g) => g.id);
  return detectSnap(level, snapAt(level, w.t, down, w.empActive ? w.t : -1), pos, bodies);
}

/** Is the vault's opening position already detected? (a broken vault) */
export function entryWatched(level: Level): CaughtBy | null {
  return detect(level, worldAt(level, 0, [], -1), level.def.entry, []);
}

/** Apply one action. Pure: returns a new state, never mutates. */
export function step(level: Level, state: GameState, action: Action): StepResult {
  if (state.status !== "playing") return { ok: false, reason: "over" };
  const def = level.def;
  const events: GameEvent[] = [];
  let pos = state.pos;
  let empLeft = state.empLeft;
  let empUntil = state.empUntil;
  let keys = state.keys;
  let loot = state.loot;
  let down = state.down;
  let bodies = state.bodies;

  // 1. act
  const dir = ACTION_DIR[action];
  if (dir) {
    const d = DELTA[dir];
    const to = { x: pos.x + d.x, y: pos.y + d.y };
    if (level.isSolid(to.x, to.y)) return { ok: false, reason: "blocked" };
    const door = level.doorAt.get(level.idx(to.x, to.y));
    if (door && !keys.includes(door)) return { ok: false, reason: "locked" };
    events.push({ type: "move", from: pos, to });
    if (door) events.push({ type: "door", color: door, at: to });
    pos = to;
  } else if (action === "E") {
    if (empLeft <= 0) return { ok: false, reason: "no-emp" };
    empLeft -= 1;
    empUntil = state.t + 3;
    events.push({ type: "emp" });
  } else {
    events.push({ type: "wait" });
  }

  const base = { ...state, moves: state.moves + action, empLeft, empUntil };
  const caught = (by: CaughtBy, t: number): StepResult => {
    events.push({ type: "caught", by, at: pos });
    return { ok: true, events, state: { ...base, t, pos, keys, loot, down, bodies, status: "caught", caught: by } };
  };

  // 2. takedown
  const here = snapAt(level, state.t, down, empUntil).guardsAt.get(level.idx(pos.x, pos.y));
  if (here) {
    const armoredSet = snapAt(level, state.t, down, empUntil).armored;
    for (const id of here) {
      if (armoredSet.has(id)) return caught({ kind: "armored", id }, state.t + 1);
    }
    for (const id of here) {
      down = [...down, id];
      bodies = [...bodies, { x: pos.x, y: pos.y, guard: id }];
      events.push({ type: "takedown", guard: id, at: pos });
    }
  }

  // 3. pick up
  const pi = level.idx(pos.x, pos.y);
  const li = level.lootAt.get(pi);
  if (li !== undefined && !loot[li]) {
    loot = loot.map((v, i) => (i === li ? true : v));
    events.push({ type: "loot", index: li, at: pos });
  }
  const kc = level.keyAt.get(pi);
  if (kc && !keys.includes(kc)) {
    keys = [...keys, kc];
    events.push({ type: "key", color: kc, at: pos });
  }

  // 4. escape
  if (samePt(pos, def.entry) && loot.every(Boolean) && loot.length > 0) {
    events.push({ type: "cracked" });
    return { ok: true, events, state: { ...base, t: state.t + 1, pos, keys, loot, down, bodies, status: "cracked" } };
  }

  // 5 + 6. tick, then detect
  const t = state.t + 1;
  const seen = detectSnap(level, snapAt(level, t, down, empUntil), pos, bodies);
  if (seen) return caught(seen, t);

  // 7. clock
  if (def.maxTurns > 0 && t >= def.maxTurns) return caught({ kind: "timeout" }, t);

  return { ok: true, events, state: { ...base, t, pos, keys, loot, down, bodies, status: "playing" } };
}

export interface RunResult {
  status: "playing" | "caught" | "cracked";
  state: GameState;
  /** index of the first move that was refused (invalid move string) */
  invalidAt: number | null;
}

/** Play a move string from the start. Stops at the end, on capture or escape. */
export function run(level: Level, moves: string): RunResult {
  let state = newGame(level.def);
  for (let i = 0; i < moves.length; i++) {
    const a = moves[i] as Action;
    if (!"UDLRWE".includes(a)) return { status: state.status, state, invalidAt: i };
    const r = step(level, state, a);
    if (!r.ok) return { status: state.status, state, invalidAt: i };
    state = r.state;
    if (state.status !== "playing") {
      return { status: state.status, state, invalidAt: i === moves.length - 1 ? null : i + 1 };
    }
  }
  return { status: state.status, state, invalidAt: null };
}

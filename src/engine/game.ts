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

/** Detection check for the thief standing at `pos` in world `w`. */
export function detect(level: Level, w: WorldSnapshot, pos: Pt, bodies: Body[]): CaughtBy | null {
  const pi = level.idx(pos.x, pos.y);
  // a guard standing on you
  for (const g of w.guards) {
    if (!g.down && g.x === pos.x && g.y === pos.y) return { kind: "guard", id: g.id };
  }
  const sources = watchedBy(level, w);
  for (const s of sources) {
    if (s.tiles.includes(pi)) return { kind: s.kind, id: s.id };
  }
  const lasers = level.laserAt.get(pi);
  if (lasers) {
    for (const li of lasers) if (w.lasers[li].on) return { kind: "laser", id: w.lasers[li].id };
  }
  // bodies: seen by any sight source, or stumbled over by a guard
  for (const b of bodies) {
    const bi = level.idx(b.x, b.y);
    for (const g of w.guards) {
      if (!g.down && g.x === b.x && g.y === b.y) return { kind: "body", id: b.guard, seenBy: g.id };
    }
    for (const s of sources) {
      if (s.tiles.includes(bi)) return { kind: "body", id: b.guard, seenBy: s.id };
    }
  }
  return null;
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
  const now = worldAt(level, state.t, down, empUntil);
  for (const g of now.guards) {
    if (g.down || g.x !== pos.x || g.y !== pos.y) continue;
    if (g.armored) return caught({ kind: "armored", id: g.id }, state.t + 1);
    down = [...down, g.id];
    bodies = [...bodies, { x: pos.x, y: pos.y, guard: g.id }];
    events.push({ type: "takedown", guard: g.id, at: pos });
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
  const next = worldAt(level, t, down, empUntil);
  const seen = detect(level, next, pos, bodies);
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

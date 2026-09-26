/**
 * VAULTS: core types.
 *
 * A vault is a small grid building. The thief starts at the entrance, must
 * collect every piece of loot and walk back out, without being seen.
 * Everything is turn-based and fully deterministic: the same vault and the
 * same move string always produce the same result, on every device and on
 * the server.
 */

export type Dir = "N" | "E" | "S" | "W";
export const DIRS: Dir[] = ["N", "E", "S", "W"];

export interface Pt {
  x: number;
  y: number;
}

/** Tile characters in `VaultDef.tiles` (row-major, width * height). */
export const TILE = {
  floor: ".",
  wall: "#",
  /** outside the building: not walkable, not rendered, blocks sight */
  void: " ",
} as const;

export type KeyColor = "red" | "blue" | "gold";
export const KEY_COLORS: KeyColor[] = ["red", "blue", "gold"];

/** One step of a guard's patrol: where it stands and which way it faces. */
export interface PatrolStep extends Pt {
  d: Dir;
}

export interface GuardDef {
  id: string;
  /** Patrol, one entry per turn, repeated forever. Consecutive steps are the same tile or orthogonal neighbours. */
  route: PatrolStep[];
  /** Vision range in tiles (1–6). */
  range: number;
  /** Armored guards can't be taken down: walking into one gets you caught. */
  armored: boolean;
}

export interface CameraDef extends Pt {
  id: string;
  /** Facing per turn, repeated forever. */
  dirs: Dir[];
  range: number;
}

export interface LaserDef {
  id: string;
  /** Beam endpoints (inclusive), on one row or one column, floor tiles only. */
  a: Pt;
  b: Pt;
  /** On/off per turn, repeated forever, e.g. "110" = on, on, off. */
  pattern: string;
}

export interface DoorDef extends Pt {
  color: KeyColor;
}

export interface KeyDef extends Pt {
  color: KeyColor;
}

export interface VaultDef {
  v: 1;
  w: number;
  h: number;
  /** w*h characters: "." floor, "#" wall, " " void */
  tiles: string;
  /** Entrance, which is also the only exit. */
  entry: Pt;
  loot: Pt[];
  doors: DoorDef[];
  keys: KeyDef[];
  guards: GuardDef[];
  cameras: CameraDef[];
  lasers: LaserDef[];
  /** EMP charges in the thief's pocket (cameras + lasers off for 3 turns). */
  emp: number;
  /** Maximum number of turns before the police arrive (0 = no limit). */
  maxTurns: number;
}

/** Thief actions. U/D/L/R move, W waits a turn, E fires an EMP. */
export type Action = "U" | "D" | "L" | "R" | "W" | "E";
export const ACTIONS: Action[] = ["U", "D", "L", "R", "W", "E"];

export type Status = "playing" | "caught" | "cracked";

export type CaughtBy =
  | { kind: "guard"; id: string }
  | { kind: "armored"; id: string }
  | { kind: "camera"; id: string }
  | { kind: "laser"; id: string }
  | { kind: "body"; id: string; seenBy: string }
  | { kind: "timeout" };

export interface Body extends Pt {
  guard: string;
}

export interface GameState {
  /** turns taken so far; the world is at time t */
  t: number;
  pos: Pt;
  /** per loot index: collected? */
  loot: boolean[];
  keys: KeyColor[];
  /** guards that were taken down (ids) */
  down: string[];
  bodies: Body[];
  empLeft: number;
  /** cameras and lasers are offline while t <= empUntil */
  empUntil: number;
  status: Status;
  caught?: CaughtBy;
  /** the move string so far (only accepted actions) */
  moves: string;
}

/** Things that happened during a turn: drives animation and sound. */
export type GameEvent =
  | { type: "move"; from: Pt; to: Pt }
  | { type: "wait" }
  | { type: "emp" }
  | { type: "takedown"; guard: string; at: Pt }
  | { type: "loot"; index: number; at: Pt }
  | { type: "key"; color: KeyColor; at: Pt }
  | { type: "door"; color: KeyColor; at: Pt }
  | { type: "caught"; by: CaughtBy; at: Pt }
  | { type: "cracked" };

export type StepResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; reason: "blocked" | "locked" | "no-emp" | "over" };

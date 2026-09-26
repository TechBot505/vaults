import { z } from "zod";
import { Level, dirBetween, laserCells, samePt } from "./geometry";
import { entryWatched } from "./game";
import type { Pt, VaultDef } from "./types";

export const LIMITS = {
  minW: 3,
  maxW: 24,
  minH: 3,
  maxH: 18,
  maxLoot: 5,
  maxKeys: 6,
  maxDoors: 16,
  maxGuards: 12,
  maxRoute: 64,
  maxCameras: 12,
  maxCameraDirs: 16,
  maxLasers: 12,
  maxPattern: 16,
  maxGuardRange: 6,
  maxCameraRange: 8,
  maxEmp: 3,
  maxTurns: 500,
} as const;

const pt = z.object({ x: z.number().int(), y: z.number().int() });
const dir = z.enum(["N", "E", "S", "W"]);
const color = z.enum(["red", "blue", "gold"]);
const id = z.string().min(1).max(24).regex(/^[a-z0-9-]+$/i);

export const vaultSchema = z.object({
  v: z.literal(1),
  w: z.number().int().min(LIMITS.minW).max(LIMITS.maxW),
  h: z.number().int().min(LIMITS.minH).max(LIMITS.maxH),
  tiles: z.string().regex(/^[.# ]*$/),
  entry: pt,
  loot: z.array(pt).min(1).max(LIMITS.maxLoot),
  doors: z.array(pt.extend({ color })).max(LIMITS.maxDoors),
  keys: z.array(pt.extend({ color })).max(LIMITS.maxKeys),
  guards: z
    .array(
      z.object({
        id,
        route: z.array(pt.extend({ d: dir })).min(1).max(LIMITS.maxRoute),
        range: z.number().int().min(1).max(LIMITS.maxGuardRange),
        armored: z.boolean(),
      }),
    )
    .max(LIMITS.maxGuards),
  cameras: z
    .array(
      pt.extend({
        id,
        dirs: z.array(dir).min(1).max(LIMITS.maxCameraDirs),
        range: z.number().int().min(1).max(LIMITS.maxCameraRange),
      }),
    )
    .max(LIMITS.maxCameras),
  lasers: z
    .array(
      z.object({
        id,
        a: pt,
        b: pt,
        pattern: z.string().min(1).max(LIMITS.maxPattern).regex(/^[01]+$/),
      }),
    )
    .max(LIMITS.maxLasers),
  emp: z.number().int().min(0).max(LIMITS.maxEmp),
  maxTurns: z.number().int().min(0).max(LIMITS.maxTurns),
});

export interface Problem {
  code: string;
  message: string;
  at?: Pt;
}

/**
 * Structural validation: everything the engine assumes is true. The editor
 * shows these live; the server refuses to publish a vault with any of them.
 */
export function validateVault(input: unknown): { ok: true; def: VaultDef; problems: [] } | { ok: false; problems: Problem[] } {
  const parsed = vaultSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, problems: parsed.error.issues.slice(0, 10).map((i) => ({ code: "schema", message: `${i.path.join(".")}: ${i.message}` })) };
  }
  const def = parsed.data as VaultDef;
  const problems: Problem[] = [];
  const add = (code: string, message: string, at?: Pt) => problems.push({ code, message, at });

  if (def.tiles.length !== def.w * def.h) {
    return { ok: false, problems: [{ code: "tiles", message: "tile map size doesn't match width × height" }] };
  }
  const inB = (p: Pt) => p.x >= 0 && p.y >= 0 && p.x < def.w && p.y < def.h;
  const tile = (p: Pt) => (inB(p) ? def.tiles[p.y * def.w + p.x] : " ");
  const isFloor = (p: Pt) => tile(p) === ".";
  const key = (p: Pt) => `${p.x},${p.y}`;
  const doorSet = new Set(def.doors.map(key));

  if (!isFloor(def.entry)) add("entry", "the entrance must be on a floor tile", def.entry);
  if (doorSet.has(key(def.entry))) add("entry", "the entrance can't be a door", def.entry);

  const occupied = new Map<string, string>();
  const claim = (p: Pt, what: string) => {
    const k = key(p);
    const prev = occupied.get(k);
    if (prev) add("overlap", `${what} overlaps ${prev}`, p);
    else occupied.set(k, what);
  };
  claim(def.entry, "the entrance");

  def.loot.forEach((l, i) => {
    if (!isFloor(l)) add("loot", `loot ${i + 1} must be on a floor tile`, l);
    claim(l, `loot ${i + 1}`);
  });
  def.doors.forEach((d) => {
    if (!isFloor(d)) add("door", "doors must be placed on floor tiles", d);
    claim(d, `a ${d.color} door`);
  });
  def.keys.forEach((k) => {
    if (!isFloor(k)) add("key", "keycards must be on floor tiles", k);
    claim(k, `a ${k.color} keycard`);
  });
  for (const d of def.doors) {
    if (!def.keys.some((k) => k.color === d.color)) add("door", `there's a ${d.color} door but no ${d.color} keycard`, d);
  }

  const ids = new Set<string>();
  const unique = (i: string) => {
    if (ids.has(i)) add("id", `duplicate id "${i}"`);
    ids.add(i);
  };

  for (const g of def.guards) {
    unique(g.id);
    g.route.forEach((s, i) => {
      if (!isFloor(s)) add("guard", `guard ${g.id} walks into a wall`, s);
      if (doorSet.has(key(s))) add("guard", `guard ${g.id} can't patrol through a door`, s);
      const next = g.route[(i + 1) % g.route.length];
      if (!samePt(s, next) && dirBetween(s, next) === null) add("guard", `guard ${g.id}'s patrol jumps between tiles`, s);
    });
  }

  for (const c of def.cameras) {
    unique(c.id);
    if (tile(c) !== "#") add("camera", "cameras are mounted on walls", c);
  }

  for (const l of def.lasers) {
    unique(l.id);
    if (l.a.x !== l.b.x && l.a.y !== l.b.y) {
      add("laser", "a laser beam must be straight (one row or one column)", l.a);
      continue;
    }
    for (const c of laserCells(l)) {
      if (!isFloor(c)) {
        add("laser", "laser beams only cross floor tiles", c);
        break;
      }
      if (doorSet.has(key(c))) {
        add("laser", "laser beams can't cross doors", c);
        break;
      }
    }
    if (!l.pattern.includes("1")) add("laser", "a laser that's never on does nothing", l.a);
  }

  if (problems.length === 0) {
    const watched = entryWatched(new Level(def));
    if (watched) add("entry", "the entrance is watched on turn 0: nobody could ever get in");
  }

  return problems.length ? { ok: false, problems } : { ok: true, def, problems: [] };
}

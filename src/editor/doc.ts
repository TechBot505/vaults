import { makeRoute, type Waypoint } from "@/engine/build";
import { LIMITS } from "@/engine/validate";
import type { CameraDef, Dir, DoorDef, KeyColor, KeyDef, LaserDef, PatrolStep, Pt, VaultDef } from "@/engine/types";

/**
 * The editor works on a friendlier document than the engine: guards are
 * described by waypoints (the per-turn patrol is derived), everything else
 * maps 1:1 to a VaultDef.
 */

export interface EditorGuard {
  id: string;
  waypoints: Waypoint[];
  mode: "loop" | "pingpong";
  range: number;
  armored: boolean;
  /** exact patrol from a forked vault; dropped as soon as the route is edited */
  raw?: PatrolStep[];
}

export interface EditorDoc {
  title: string;
  w: number;
  h: number;
  tiles: string;
  entry: Pt;
  loot: Pt[];
  doors: DoorDef[];
  keys: KeyDef[];
  guards: EditorGuard[];
  cameras: CameraDef[];
  lasers: LaserDef[];
  emp: number;
  maxTurns: number;
}

export function blankDoc(w = 15, h = 10): EditorDoc {
  let tiles = "";
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) tiles += x === 0 || y === 0 || x === w - 1 || y === h - 1 ? "#" : ".";
  return {
    title: "Untitled vault",
    w,
    h,
    tiles,
    entry: { x: 1, y: 1 },
    loot: [{ x: w - 2, y: h - 2 }],
    doors: [],
    keys: [],
    guards: [],
    cameras: [],
    lasers: [],
    emp: 0,
    maxTurns: 0,
  };
}

export const tileAt = (d: EditorDoc, p: Pt) => (p.x >= 0 && p.y >= 0 && p.x < d.w && p.y < d.h ? d.tiles[p.y * d.w + p.x] : " ");
const same = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;

export function walkableIn(d: EditorDoc) {
  const doors = new Set(d.doors.map((x) => `${x.x},${x.y}`));
  return (x: number, y: number) => tileAt(d, { x, y }) === "." && !doors.has(`${x},${y}`);
}

/** Convert to an engine vault. Guards whose waypoints can't be connected are reported. */
export function toVault(d: EditorDoc): { def: VaultDef; routeErrors: { guard: string; message: string }[] } {
  const walk = walkableIn(d);
  const routeErrors: { guard: string; message: string }[] = [];
  const guards = d.guards.map((g) => {
    const route = g.raw ?? (g.waypoints.length ? makeRoute(g.waypoints, walk, d.w, d.h, g.mode) : null);
    if (!route || route.length === 0) {
      routeErrors.push({ guard: g.id, message: `guard ${g.id} can't walk between its waypoints` });
      return { id: g.id, route: [{ x: g.waypoints[0]?.x ?? 0, y: g.waypoints[0]?.y ?? 0, d: "S" as Dir }], range: g.range, armored: g.armored };
    }
    if (route.length > LIMITS.maxRoute) routeErrors.push({ guard: g.id, message: `guard ${g.id}'s patrol is too long (${route.length} > ${LIMITS.maxRoute} turns)` });
    return { id: g.id, route, range: g.range, armored: g.armored };
  });
  const def: VaultDef = {
    v: 1,
    w: d.w,
    h: d.h,
    tiles: d.tiles,
    entry: d.entry,
    loot: d.loot,
    doors: d.doors,
    keys: d.keys,
    guards,
    cameras: d.cameras,
    lasers: d.lasers,
    emp: d.emp,
    maxTurns: d.maxTurns,
  };
  return { def, routeErrors };
}

/** Rebuild an editor doc from a vault (fork a published vault or a heist). */
export function fromVault(def: VaultDef, title = "Forked vault"): EditorDoc {
  return {
    title,
    w: def.w,
    h: def.h,
    tiles: def.tiles,
    entry: def.entry,
    loot: def.loot,
    doors: def.doors,
    keys: def.keys,
    // patrols come back as one waypoint per step: exact, and still editable
    guards: def.guards.map((g) => ({ id: g.id, waypoints: routeToWaypoints(g.route), mode: "loop", range: g.range, armored: g.armored, raw: g.route })),
    cameras: def.cameras,
    lasers: def.lasers,
    emp: def.emp,
    maxTurns: def.maxTurns,
  };
}

/** Compress a per-turn route into waypoints at every corner / pause. */
export function routeToWaypoints(route: { x: number; y: number; d: Dir }[]): Waypoint[] {
  const wps: Waypoint[] = [];
  for (let i = 0; i < route.length; i++) {
    const s = route[i];
    const last = wps[wps.length - 1];
    if (last && last.x === s.x && last.y === s.y) {
      last.wait = (last.wait ?? 0) + 1;
      last.look = [...(last.look ?? []), s.d];
      continue;
    }
    wps.push({ x: s.x, y: s.y });
  }
  return wps;
}

// ── pure mutations ──────────────────────────────────────────────────────────

export type Paint = "#" | "." | " ";

function removeAt(d: EditorDoc, p: Pt, opts: { keepEntry?: boolean } = {}): EditorDoc {
  return {
    ...d,
    loot: d.loot.filter((l) => !same(l, p)),
    doors: d.doors.filter((l) => !same(l, p)),
    keys: d.keys.filter((l) => !same(l, p)),
    cameras: d.cameras.filter((c) => !same(c, p)),
    lasers: d.lasers.filter((l) => !laserCovers(l, p)),
    guards: dropWaypointsAt(d.guards, p),
    entry: opts.keepEntry ? d.entry : d.entry,
  };
}

function dropWaypointsAt(guards: EditorGuard[], p: Pt): EditorGuard[] {
  return guards
    .map((g) => {
      const onRaw = g.raw?.some((s) => same(s, p));
      const hasWp = g.waypoints.some((w) => same(w, p));
      if (!onRaw && !hasWp) return g;
      return { ...g, raw: undefined, waypoints: g.waypoints.filter((w) => !same(w, p)) };
    })
    .filter((g) => g.waypoints.length > 0);
}

export function laserCovers(l: LaserDef, p: Pt): boolean {
  if (l.a.y === l.b.y && p.y === l.a.y) return p.x >= Math.min(l.a.x, l.b.x) && p.x <= Math.max(l.a.x, l.b.x);
  if (l.a.x === l.b.x && p.x === l.a.x) return p.y >= Math.min(l.a.y, l.b.y) && p.y <= Math.max(l.a.y, l.b.y);
  return false;
}

export function paint(d: EditorDoc, p: Pt, t: Paint): EditorDoc {
  if (tileAt(d, p) === t) return d;
  if (same(p, d.entry) && t !== ".") return d; // the entrance stays on the floor
  const i = p.y * d.w + p.x;
  const tiles = d.tiles.slice(0, i) + t + d.tiles.slice(i + 1);
  let next: EditorDoc = { ...d, tiles };
  if (t !== ".") {
    // walls/void can't hold loot, keys, doors, guards or lasers
    const cams = d.cameras;
    next = removeAt(next, p);
    // cameras live on walls: keep them if we painted a wall
    if (t === "#") next.cameras = cams;
  } else {
    // cameras can't sit on floor
    next.cameras = d.cameras.filter((c) => !same(c, p));
  }
  return next;
}

export function nextId(prefix: string, used: string[]): string {
  let n = 1;
  while (used.includes(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export function setEntry(d: EditorDoc, p: Pt): EditorDoc {
  if (tileAt(d, p) !== ".") return d;
  const cleared = removeAt(d, p);
  return { ...cleared, entry: p, cameras: d.cameras, guards: d.guards };
}

export function toggleLoot(d: EditorDoc, p: Pt): EditorDoc {
  if (tileAt(d, p) !== "." || same(p, d.entry)) return d;
  if (d.loot.some((l) => same(l, p))) {
    if (d.loot.length === 1) return d; // a vault needs loot
    return { ...d, loot: d.loot.filter((l) => !same(l, p)) };
  }
  if (d.loot.length >= LIMITS.maxLoot) return d;
  const cleared = { ...d, keys: d.keys.filter((k) => !same(k, p)), doors: d.doors.filter((k) => !same(k, p)) };
  return { ...cleared, loot: [...d.loot, p] };
}

export function placeKey(d: EditorDoc, p: Pt, color: KeyColor): EditorDoc {
  if (tileAt(d, p) !== "." || same(p, d.entry) || d.loot.some((l) => same(l, p))) return d;
  const existing = d.keys.find((k) => same(k, p));
  if (existing && existing.color === color) return { ...d, keys: d.keys.filter((k) => !same(k, p)) };
  if (!existing && d.keys.length >= LIMITS.maxKeys) return d;
  return { ...d, doors: d.doors.filter((k) => !same(k, p)), keys: [...d.keys.filter((k) => !same(k, p)), { ...p, color }] };
}

export function placeDoor(d: EditorDoc, p: Pt, color: KeyColor): EditorDoc {
  if (tileAt(d, p) !== "." || same(p, d.entry) || d.loot.some((l) => same(l, p))) return d;
  const existing = d.doors.find((k) => same(k, p));
  if (existing && existing.color === color) return { ...d, doors: d.doors.filter((k) => !same(k, p)) };
  if (!existing && d.doors.length >= LIMITS.maxDoors) return d;
  return {
    ...d,
    keys: d.keys.filter((k) => !same(k, p)),
    doors: [...d.doors.filter((k) => !same(k, p)), { ...p, color }],
    // nothing patrols or shines through a door
    guards: dropWaypointsAt(d.guards, p),
    lasers: d.lasers.filter((l) => !laserCovers(l, p)),
  };
}

export function eraseAt(d: EditorDoc, p: Pt): EditorDoc {
  return removeAt(d, p);
}

export function addGuard(d: EditorDoc, p: Pt): { doc: EditorDoc; id: string | null } {
  if (!walkableIn(d)(p.x, p.y) || d.guards.length >= LIMITS.maxGuards) return { doc: d, id: null };
  const id = nextId("g", d.guards.map((g) => g.id));
  return { doc: { ...d, guards: [...d.guards, { id, waypoints: [{ ...p, wait: 1, look: ["S"] }], mode: "pingpong", range: 3, armored: false }] }, id };
}

export function addWaypoint(d: EditorDoc, id: string, p: Pt): EditorDoc {
  if (!walkableIn(d)(p.x, p.y)) return d;
  return {
    ...d,
    guards: d.guards.map((g) => {
      if (g.id !== id) return g;
      const last = g.waypoints[g.waypoints.length - 1];
      if (last && same(last, p)) return g;
      // a lone post-guard becomes a walker once it has somewhere to go
      const wps = g.waypoints.length === 1 ? [{ x: g.waypoints[0].x, y: g.waypoints[0].y }] : g.waypoints;
      return { ...g, raw: undefined, waypoints: [...wps, { x: p.x, y: p.y }] };
    }),
  };
}

export function updateGuard(d: EditorDoc, id: string, patch: Partial<EditorGuard>): EditorDoc {
  const reroute = "waypoints" in patch || "mode" in patch;
  return { ...d, guards: d.guards.map((g) => (g.id === id ? { ...g, ...patch, ...(reroute ? { raw: undefined } : {}) } : g)) };
}

export function removeGuard(d: EditorDoc, id: string): EditorDoc {
  return { ...d, guards: d.guards.filter((g) => g.id !== id) };
}

export function addCamera(d: EditorDoc, p: Pt): { doc: EditorDoc; id: string | null } {
  if (tileAt(d, p) !== "#" || d.cameras.some((c) => same(c, p)) || d.cameras.length >= LIMITS.maxCameras) return { doc: d, id: null };
  // face the open side
  const open = (["S", "N", "E", "W"] as Dir[]).find((dir) => {
    const v = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[dir];
    return tileAt(d, { x: p.x + v[0], y: p.y + v[1] }) === ".";
  });
  if (!open) return { doc: d, id: null };
  const id = nextId("c", d.cameras.map((c) => c.id));
  return { doc: { ...d, cameras: [...d.cameras, { id, x: p.x, y: p.y, dirs: [open], range: 4 }] }, id };
}

export function updateCamera(d: EditorDoc, id: string, patch: Partial<CameraDef>): EditorDoc {
  return { ...d, cameras: d.cameras.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
}

export function addLaser(d: EditorDoc, a: Pt, b: Pt): { doc: EditorDoc; id: string | null } {
  if (a.x !== b.x && a.y !== b.y) return { doc: d, id: null };
  if (d.lasers.length >= LIMITS.maxLasers) return { doc: d, id: null };
  const cand: LaserDef = { id: "", a, b, pattern: "10" };
  const walk = walkableIn(d);
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!walk(x, y)) return { doc: d, id: null };
  const id = nextId("l", d.lasers.map((l) => l.id));
  return { doc: { ...d, lasers: [...d.lasers, { ...cand, id }] }, id };
}

export function updateLaser(d: EditorDoc, id: string, patch: Partial<LaserDef>): EditorDoc {
  return { ...d, lasers: d.lasers.map((l) => (l.id === id ? { ...l, ...patch } : l)) };
}

/** Resize, anchored at the top-left; new space is outer wall + floor. */
export function resize(d: EditorDoc, w: number, h: number): EditorDoc {
  w = Math.max(LIMITS.minW, Math.min(LIMITS.maxW, w));
  h = Math.max(LIMITS.minH, Math.min(LIMITS.maxH, h));
  let tiles = "";
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < d.w && y < d.h && x < w - 1 && y < h - 1) tiles += d.tiles[y * d.w + x];
      else tiles += x === w - 1 || y === h - 1 || x === 0 || y === 0 ? "#" : ".";
    }
  }
  const inside = (p: Pt) => p.x < w - 1 && p.y < h - 1;
  const next: EditorDoc = {
    ...d,
    w,
    h,
    tiles,
    loot: d.loot.filter(inside),
    doors: d.doors.filter(inside),
    keys: d.keys.filter(inside),
    cameras: d.cameras.filter((c) => c.x < w && c.y < h),
    lasers: d.lasers.filter((l) => inside(l.a) && inside(l.b)),
    guards: d.guards
      .map((g) => ({ ...g, raw: g.raw && g.raw.every(inside) ? g.raw : undefined, waypoints: g.waypoints.filter(inside) }))
      .filter((g) => g.waypoints.length > 0),
  };
  if (!inside(d.entry)) next.entry = { x: 1, y: 1 };
  if (next.loot.length === 0) next.loot = [{ x: w - 2, y: h - 2 }];
  // make sure entry & loot sit on floor after trimming
  const fix = (p: Pt) => {
    const i = p.y * w + p.x;
    next.tiles = next.tiles.slice(0, i) + "." + next.tiles.slice(i + 1);
  };
  fix(next.entry);
  next.loot.forEach(fix);
  return next;
}

/** Stable hash of a vault definition (proof-of-crack is tied to it). */
export function hashVault(def: VaultDef): string {
  const s = JSON.stringify(def);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0"));
}

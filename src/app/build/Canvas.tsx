"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Board, type Inspect } from "@/components/board/Board";
import { sceneFor } from "@/components/board/scene";
import { useTileSize } from "@/components/board/useTileSize";
import { guardStep, worldPeriod, type Level } from "@/engine/geometry";
import type { Problem } from "@/engine/validate";
import type { Pt } from "@/engine/types";
import { useEditor } from "@/editor/store";
import {
  addCamera,
  addGuard,
  addLaser,
  addWaypoint,
  eraseAt,
  laserCovers,
  paint,
  placeDoor,
  placeKey,
  setEntry,
  tileAt,
  toggleLoot,
  walkableIn,
  type EditorDoc,
  type Paint,
} from "@/editor/doc";
import { toast } from "@/components/Toaster";
import { sfx } from "@/lib/sound";

const same = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;

/** Tiles on a line from a (exclusive) to b (inclusive), 4-connected so walls have no diagonal gaps. */
function cellsBetween(a: Pt, b: Pt): Pt[] {
  const out: Pt[] = [];
  let { x, y } = a;
  const n = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  for (let i = 1; i <= n; i++) {
    // step along whichever axis is further behind the straight line
    const tx = a.x + ((b.x - a.x) * i) / n;
    const ty = a.y + ((b.y - a.y) * i) / n;
    if (Math.abs(tx - x) >= Math.abs(ty - y)) x += Math.sign(b.x - x);
    else y += Math.sign(b.y - y);
    out.push({ x, y });
  }
  return out;
}

/** What's under the cursor, for select / guard / camera / laser clicks. */
function hitTest(doc: EditorDoc, level: Level, t: number, p: Pt): Inspect {
  const def = level.def;
  for (const g of def.guards) if (same(guardStep(g, t), p)) return { kind: "guard", id: g.id };
  for (const g of doc.guards) if (g.waypoints.some((w) => same(w, p))) return { kind: "guard", id: g.id };
  for (const c of doc.cameras) if (same(c, p)) return { kind: "camera", id: c.id };
  for (const l of doc.lasers) if (laserCovers(l, p)) return { kind: "laser", id: l.id };
  return null;
}

export function Canvas({ level, problems }: { level: Level; problems: Problem[] }) {
  const doc = useEditor((s) => s.doc);
  const tool = useEditor((s) => s.tool);
  const selection = useEditor((s) => s.selection);
  const laserStart = useEditor((s) => s.laserStart);
  const t = useEditor((s) => s.t);
  const setT = useEditor((s) => s.setT);
  const def = level.def;
  const { ref, tile } = useTileSize(def.w, def.h, { max: 46, min: 14 });
  const [hover, setHover] = useState<Pt | null>(null);
  const [playing, setPlaying] = useState(false);
  const stroke = useRef<{ paint?: Paint; erase?: boolean; last: Pt } | null>(null);

  const period = useMemo(() => Math.min(240, worldPeriod(def, 240)), [def]);
  const shownT = t % period;
  const scene = useMemo(() => sceneFor(level, null, shownT), [level, shownT]);

  // patrol playback
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const s = useEditor.getState();
      s.setT((s.t + 1) % period);
    }, 320);
    return () => clearInterval(id);
  }, [playing, period]);

  // the editor shortcut for play/pause lives in BuildClient; it toggles via this event
  useEffect(() => {
    const onToggle = () => setPlaying((p) => !p);
    window.addEventListener("vaults:toggle-timeline", onToggle);
    return () => window.removeEventListener("vaults:toggle-timeline", onToggle);
  }, []);

  const onTile = (p: Pt, type: "down" | "enter" | "up", e: React.PointerEvent) => {
    const st = useEditor.getState();
    const d = st.doc;
    if (type === "up") {
      stroke.current = null;
      return;
    }
    if (type === "enter") {
      setHover((h) => (h && same(h, p) ? h : p));
      const s = stroke.current;
      if (!s || !(e.buttons & 1)) return;
      if (same(s.last, p)) return;
      // fast drags skip tiles: fill in every tile on the way
      let next = st.doc;
      for (const c of cellsBetween(s.last, p)) next = s.paint ? paint(next, c, s.paint) : eraseAt(next, c);
      s.last = p;
      st.commit(next, true);
      return;
    }
    if (e.button !== 0 && e.pointerType === "mouse") return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setHover(p);
    const tileNow = tileAt(d, p);

    switch (st.tool) {
      case "wall":
      case "floor":
      case "void": {
        const target: Paint = st.tool === "wall" ? "#" : st.tool === "void" ? " " : ".";
        // starting a stroke on the same material flips the brush (knock walls down)
        const brush: Paint = st.tool !== "floor" && tileNow === target ? "." : target;
        if (same(p, d.entry) && brush !== ".") {
          toast({ title: "The entrance stays on the floor", body: "Move it first with the entrance tool." });
          return;
        }
        stroke.current = { paint: brush, last: p };
        st.commit(paint(d, p, brush));
        sfx("tick");
        return;
      }
      case "erase":
        stroke.current = { erase: true, last: p };
        st.commit(eraseAt(d, p));
        sfx("tick");
        return;
      case "entry":
        if (tileNow !== ".") return toast({ title: "The entrance goes on a floor tile" });
        st.commit(setEntry(d, p));
        sfx("click");
        return;
      case "loot": {
        if (tileNow !== ".") return toast({ title: "Loot goes on a floor tile" });
        const next = toggleLoot(d, p);
        if (next === d && d.loot.length >= 5 && !d.loot.some((l) => same(l, p))) toast({ title: "Five pieces of loot is the limit" });
        if (next === d && d.loot.length === 1 && same(d.loot[0], p)) toast({ title: "A vault needs at least one piece of loot" });
        st.commit(next);
        sfx("loot");
        return;
      }
      case "key":
        if (tileNow !== ".") return toast({ title: "Keycards go on a floor tile" });
        st.commit(placeKey(d, p, st.color));
        sfx("key");
        return;
      case "door":
        if (tileNow !== ".") return toast({ title: "Doors go on a floor tile", body: "Put them in a gap in a wall." });
        st.commit(placeDoor(d, p, st.color));
        sfx("door");
        return;
      case "guard": {
        const hit = hitTest(d, level, shownT, p);
        if (hit?.kind === "guard") {
          st.select(hit);
          return;
        }
        if (!walkableIn(d)(p.x, p.y)) return toast({ title: "Guards walk on open floor" });
        const sel = st.selection;
        if (sel?.kind === "guard" && d.guards.some((g) => g.id === sel.id)) {
          st.commit(addWaypoint(d, sel.id, p));
          sfx("step");
          return;
        }
        const r = addGuard(d, p);
        if (!r.id) return toast({ title: "Twelve guards is the limit" });
        st.commit(r.doc);
        st.select({ kind: "guard", id: r.id });
        sfx("click");
        return;
      }
      case "camera": {
        const existing = d.cameras.find((c) => same(c, p));
        if (existing) return st.select({ kind: "camera", id: existing.id });
        if (tileNow !== "#") return toast({ title: "Cameras mount on walls", body: "Click a wall tile next to open floor." });
        const r = addCamera(d, p);
        if (!r.id) return toast({ title: "Nothing to watch here", body: "A camera needs open floor beside it (or you've hit the limit of 12)." });
        st.commit(r.doc);
        st.select({ kind: "camera", id: r.id });
        sfx("click");
        return;
      }
      case "laser": {
        const start = st.laserStart;
        if (start) {
          if (same(start, p)) return st.setLaserStart(null);
          const r = addLaser(d, start, p);
          if (!r.id) {
            toast({ title: "Lasers run straight", body: "Pick a tile in the same row or column, with open floor all the way." });
            return;
          }
          st.commit(r.doc);
          st.setLaserStart(null);
          st.select({ kind: "laser", id: r.id });
          sfx("click");
          return;
        }
        const on = d.lasers.find((l) => laserCovers(l, p));
        if (on) return st.select({ kind: "laser", id: on.id });
        if (!walkableIn(d)(p.x, p.y)) return toast({ title: "Lasers cross open floor" });
        st.setLaserStart(p);
        return;
      }
      case "select":
        st.select(hitTest(d, level, shownT, p));
        return;
    }
  };

  // ── overlay: editing aids drawn in tile units on top of the board ──
  const selGuard = selection?.kind === "guard" ? doc.guards.find((g) => g.id === selection.id) : undefined;
  const selCam = selection?.kind === "camera" ? doc.cameras.find((c) => c.id === selection.id) : undefined;
  const selLaser = selection?.kind === "laser" ? doc.lasers.find((l) => l.id === selection.id) : undefined;
  const laserPreview = laserStart && hover && (laserStart.x === hover.x || laserStart.y === hover.y) ? hover : null;
  const hoverColor = tool === "erase" ? "var(--alarm)" : tool === "laser" ? "var(--laser)" : tool === "loot" ? "var(--gold)" : "var(--cyan)";

  const overlay = (
    <g pointerEvents="none" aria-hidden>
      {/* outside tiles: faint dots so the whole canvas is visible */}
      {Array.from({ length: def.w * def.h }, (_, i) =>
        def.tiles[i] === " " ? <circle key={i} cx={(i % def.w) + 0.5} cy={((i / def.w) | 0) + 0.5} r="0.03" fill="var(--faint)" /> : null,
      )}
      <rect x="0" y="0" width={def.w} height={def.h} fill="none" stroke="var(--line)" strokeWidth="0.03" strokeDasharray="0.1 0.1" />

      {/* every patrol, faintly */}
      {def.guards.map((g) =>
        g.id === selGuard?.id || g.route.length < 2 ? null : (
          <polyline key={g.id} points={[...g.route, g.route[0]].map((s) => `${s.x + 0.5},${s.y + 0.5}`).join(" ")} fill="none" stroke="var(--alarm)" strokeWidth="0.03" strokeDasharray="0.06 0.1" opacity="0.35" />
        ),
      )}

      {/* selected guard's waypoints */}
      {selGuard &&
        !selGuard.raw &&
        selGuard.waypoints.map((w, i) => (
          <g key={i} transform={`translate(${w.x + 0.5} ${w.y + 0.5})`}>
            <circle r="0.2" fill="var(--ink)" stroke="var(--cyan)" strokeWidth="0.045" />
            <text y="0.09" fontSize="0.24" textAnchor="middle" fill="var(--cyan)" fontFamily="var(--font-mono)">
              {i + 1}
            </text>
          </g>
        ))}

      {selCam && <rect x={selCam.x + 0.04} y={selCam.y + 0.04} width="0.92" height="0.92" rx="0.12" fill="none" stroke="var(--amber)" strokeWidth="0.06" className="dash-march" strokeDasharray="0.15 0.1" />}
      {selLaser && (
        <rect
          x={Math.min(selLaser.a.x, selLaser.b.x) + 0.08}
          y={Math.min(selLaser.a.y, selLaser.b.y) + 0.08}
          width={Math.abs(selLaser.a.x - selLaser.b.x) + 0.84}
          height={Math.abs(selLaser.a.y - selLaser.b.y) + 0.84}
          rx="0.12"
          fill="none"
          stroke="var(--laser)"
          strokeWidth="0.05"
          strokeDasharray="0.15 0.1"
          className="dash-march"
        />
      )}

      {/* laser being stretched */}
      {laserStart && (
        <g>
          <rect x={laserStart.x + 0.15} y={laserStart.y + 0.15} width="0.7" height="0.7" rx="0.1" fill="var(--laser)" opacity="0.3" className="laser-live" />
          {laserPreview && (
            <line x1={laserStart.x + 0.5} y1={laserStart.y + 0.5} x2={laserPreview.x + 0.5} y2={laserPreview.y + 0.5} stroke="var(--laser)" strokeWidth="0.06" strokeDasharray="0.1 0.08" opacity="0.8" />
          )}
        </g>
      )}

      {/* problems */}
      {problems.map((p, i) =>
        p.at ? (
          <g key={i} transform={`translate(${p.at.x + 0.5} ${p.at.y + 0.5})`}>
            <circle r="0.44" fill="none" stroke="var(--alarm)" strokeWidth="0.05" className="laser-live" />
          </g>
        ) : null,
      )}

      {hover && <rect x={hover.x + 0.02} y={hover.y + 0.02} width="0.96" height="0.96" rx="0.08" fill="none" stroke={hoverColor} strokeWidth="0.05" opacity="0.9" />}
    </g>
  );

  const inspect: Inspect = selection && selection.kind !== "laser" ? selection : null;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        ref={ref}
        className="relative flex h-[min(62vh,calc((100vw-1.5rem)*var(--ar)))] min-h-[200px] w-full items-center justify-center lg:h-[calc(100dvh-13.5rem)] lg:min-h-[320px]"
        style={{ ["--ar" as string]: String((def.h + 1.2) / (def.w + 1.2)) }}
        onPointerLeave={() => setHover(null)}
      >
        <Board level={level} scene={scene} tile={tile} hideThief inspect={inspect} onTilePointer={onTile} overlay={overlay} stepMs={260} ariaLabel="Vault being built" className={tool === "select" ? "cursor-default" : "cursor-crosshair"} />
      </div>
      <div className="flex items-center gap-3 rounded-md border border-line bg-ink2/60 px-3 py-2 font-mono text-xs text-dim">
        <button onClick={() => setPlaying((p) => !p)} className="press grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paper text-ink" aria-label={playing ? "Pause patrols" : "Play patrols"} title="Play patrols (Space)">
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <span className="hidden shrink-0 sm:inline">timeline</span>
        <input type="range" min={0} max={Math.max(0, period - 1)} value={shownT} onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} className="min-w-0 flex-1 accent-[var(--cyan)]" aria-label="Preview turn" />
        <span className="w-24 shrink-0 text-right text-paper">
          turn {shownT}
          <span className="text-faint"> / {period}</span>
        </span>
      </div>
    </div>
  );
}

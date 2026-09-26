"use client";

import { memo, useMemo, type ReactNode } from "react";
import type { Level } from "@/engine/geometry";
import type { CaughtBy, KeyColor, Pt } from "@/engine/types";
import { doorHorizontal, floorFill, laserGeom, wallFill, wallOutline, type Scene } from "./scene";
import { angleAt, unwrapped } from "./angles";

export type Inspect = { kind: "guard" | "camera" | "laser"; id: string } | null;

export interface Fx {
  id: number;
  kind: "emp" | "loot" | "takedown" | "key" | "door";
  at: Pt;
}

export interface BoardProps {
  level: Level;
  scene: Scene;
  /** px per tile */
  tile: number;
  forecast?: boolean;
  caught?: CaughtBy | null;
  inspect?: Inspect;
  onInspect?: (sel: Inspect) => void;
  trail?: Pt[];
  fx?: Fx[];
  /** ms per turn animation */
  stepMs?: number;
  /** editor hooks */
  onTilePointer?: (p: Pt, type: "down" | "enter" | "up", e: React.PointerEvent) => void;
  overlay?: ReactNode;
  className?: string;
  /** hide the thief (editor / previews) */
  hideThief?: boolean;
  ariaLabel?: string;
}

const KEY_FILL: Record<KeyColor, string> = { red: "var(--red-key)", blue: "var(--blue-key)", gold: "var(--gold-key)" };

function BoardImpl({
  level,
  scene,
  tile,
  forecast = false,
  caught = null,
  inspect = null,
  onInspect,
  trail = [],
  fx = [],
  stepMs = 150,
  onTilePointer,
  overlay,
  className = "",
  hideThief = false,
  ariaLabel,
}: BoardProps) {
  const def = level.def;
  const { w, h } = def;

  // static geometry, computed once per vault
  const geo = useMemo(
    () => ({
      walls: wallFill(level),
      outline: wallOutline(level),
      floor: floorFill(level),
      floorCells: Array.from({ length: w * h }, (_, i) => i).filter((i) => def.tiles[i] === "."),
      guardAngles: new Map(def.guards.map((g) => [g.id, unwrapped(g.route.map((s) => s.d))])),
      cameraAngles: new Map(def.cameras.map((c) => [c.id, unwrapped(c.dirs)])),
      lasers: def.lasers.map((l) => ({ id: l.id, ...laserGeom(level, l) })),
    }),
    [level, def, w, h],
  );

  const t = scene.t;
  const world = scene.world;
  const downIds = new Set(scene.bodies.map((b) => b.guard));
  const pad = 0.6;

  const sourceHighlight = caught && (caught.kind === "guard" || caught.kind === "camera" || caught.kind === "armored") ? caught.id : caught && caught.kind === "body" ? caught.seenBy : null;
  const laserHighlight = caught && caught.kind === "laser" ? caught.id : null;
  const bodyHighlight = caught && caught.kind === "body" ? caught.id : null;

  const tileFromEvent = (e: React.PointerEvent<SVGSVGElement>): Pt | null => {
    const svg = e.currentTarget;
    const r = svg.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * (w + pad * 2) - pad);
    const y = Math.floor(((e.clientY - r.top) / r.height) * (h + pad * 2) - pad);
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
    return { x, y };
  };

  const inspectedGuard = inspect?.kind === "guard" ? def.guards.find((g) => g.id === inspect.id) : undefined;
  const inspectedCamera = inspect?.kind === "camera" ? def.cameras.find((c) => c.id === inspect.id) : undefined;

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? "Vault blueprint"}
      width={(w + pad * 2) * tile}
      height={(h + pad * 2) * tile}
      viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`}
      className={`block select-none touch-none ${className}`}
      style={{ ["--step-ms" as string]: `${stepMs}ms` }}
      onPointerDown={onTilePointer ? (e) => { const p = tileFromEvent(e); if (p) onTilePointer(p, "down", e); } : undefined}
      onPointerMove={onTilePointer ? (e) => { const p = tileFromEvent(e); if (p) onTilePointer(p, "enter", e); } : undefined}
      onPointerUp={onTilePointer ? (e) => { const p = tileFromEvent(e); if (p) onTilePointer(p, "up", e); } : undefined}
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.09" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glow-strong" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="0.22" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="tilegrid" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M1 0V1H0" fill="none" stroke="var(--line)" strokeWidth="0.02" />
        </pattern>
        <pattern id="wallhatch" width="0.2" height="0.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V0.2" stroke="var(--cyan)" strokeWidth="0.018" opacity="0.28" />
        </pattern>
        <pattern id="hatch" width="0.25" height="0.25" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V0.25" stroke="var(--mint)" strokeWidth="0.05" opacity="0.5" />
        </pattern>
        <radialGradient id="thiefGlow">
          <stop offset="0" stopColor="var(--mint)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--mint)" stopOpacity="0" />
        </radialGradient>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="var(--cyan)" />
        </marker>
      </defs>

      {/* floor & walls */}
      <path d={geo.floor} fill="color-mix(in oklab, var(--ink-3) 55%, transparent)" />
      <path d={geo.floor} fill="url(#tilegrid)" />
      <path d={geo.walls} fill="color-mix(in oklab, var(--cyan) 6%, var(--ink))" />
      <path d={geo.walls} fill="url(#wallhatch)" />
      <path d={geo.outline} stroke="var(--cyan)" strokeWidth="0.06" strokeLinecap="square" fill="none" filter="url(#glow)" />

      {/* entrance */}
      <g transform={`translate(${def.entry.x} ${def.entry.y})`}>
        <rect x="0.06" y="0.06" width="0.88" height="0.88" fill="url(#hatch)" />
        <rect x="0.06" y="0.06" width="0.88" height="0.88" fill="none" stroke="var(--mint)" strokeWidth="0.04" strokeDasharray="0.12 0.08" className="dash-march" opacity="0.8" />
      </g>

      {/* who's watching which tile, now */}
      <g aria-hidden>
        {geo.floorCells.map((i) => {
          const v = scene.watched[i];
          const x = i % w;
          const y = (i / w) | 0;
          return (
            <g key={i}>
              <rect x={x + 0.03} y={y + 0.03} width="0.94" height="0.94" rx="0.08" fill="var(--alarm)" opacity={v & 1 ? 0.2 : 0} className="watch" />
              <rect x={x + 0.03} y={y + 0.03} width="0.94" height="0.94" rx="0.08" fill="var(--amber)" opacity={v & 2 ? 0.18 : 0} className="watch" />
            </g>
          );
        })}
      </g>

      {/* forecast: next turn's gaze, dashed */}
      {forecast && (
        <g aria-hidden>
          {geo.floorCells.map((i) =>
            scene.next[i] ? (
              <rect
                key={i}
                x={(i % w) + 0.12}
                y={((i / w) | 0) + 0.12}
                width="0.76"
                height="0.76"
                rx="0.06"
                fill="none"
                stroke={scene.next[i] & 1 ? "var(--alarm)" : "var(--amber)"}
                strokeWidth="0.035"
                strokeDasharray="0.1 0.07"
                opacity="0.75"
              />
            ) : null,
          )}
        </g>
      )}

      {/* lasers */}
      {geo.lasers.map((l, li) => {
        const on = world.lasers[li].on;
        const nextOn = scene.nextWorld.lasers[li].on;
        const hl = laserHighlight === l.id;
        return (
          <g key={l.id} onPointerEnter={onInspect ? () => onInspect({ kind: "laser", id: l.id }) : undefined} onPointerLeave={onInspect ? () => onInspect(null) : undefined}>
            <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="transparent" strokeWidth="0.5" />
            {on ? (
              <g className="laser-live" filter="url(#glow-strong)">
                <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--laser)" strokeWidth={hl ? 0.14 : 0.08} strokeLinecap="round" />
                <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#fff" strokeWidth="0.022" strokeLinecap="round" opacity="0.9" />
              </g>
            ) : (
              <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--laser)" strokeWidth="0.03" strokeDasharray="0.08 0.1" opacity={forecast && nextOn ? 0.75 : 0.28} />
            )}
            {[
              [l.x1, l.y1],
              [l.x2, l.y2],
            ].map(([x, y], k) => (
              <rect key={k} x={x - 0.09} y={y - 0.09} width="0.18" height="0.18" rx="0.03" fill={on ? "var(--laser)" : "var(--faint)"} filter={on ? "url(#glow)" : undefined} />
            ))}
          </g>
        );
      })}

      {/* doors */}
      {def.doors.map((d, i) => {
        const open = scene.keys.includes(d.color);
        const horiz = doorHorizontal(level, d);
        const c = KEY_FILL[d.color];
        return (
          <g key={i} transform={`translate(${d.x} ${d.y})`}>
            {horiz ? (
              <>
                <rect x={open ? -0.02 : 0.04} y="0.4" width={open ? 0.26 : 0.46} height="0.2" rx="0.04" fill={c} opacity={open ? 0.45 : 1} style={{ transition: "all 0.35s" }} />
                <rect x={open ? 0.76 : 0.5} y="0.4" width={open ? 0.26 : 0.46} height="0.2" rx="0.04" fill={c} opacity={open ? 0.45 : 1} style={{ transition: "all 0.35s" }} />
              </>
            ) : (
              <>
                <rect x="0.4" y={open ? -0.02 : 0.04} width="0.2" height={open ? 0.26 : 0.46} rx="0.04" fill={c} opacity={open ? 0.45 : 1} style={{ transition: "all 0.35s" }} />
                <rect x="0.4" y={open ? 0.76 : 0.5} width="0.2" height={open ? 0.26 : 0.46} rx="0.04" fill={c} opacity={open ? 0.45 : 1} style={{ transition: "all 0.35s" }} />
              </>
            )}
            {!open && <circle cx="0.5" cy="0.5" r="0.06" fill="var(--ink)" />}
          </g>
        );
      })}

      {/* keycards */}
      {def.keys.map((k, i) =>
        scene.keys.includes(k.color) ? null : (
          <g key={i} transform={`translate(${k.x + 0.5} ${k.y + 0.5})`} filter="url(#glow)">
            <rect x="-0.2" y="-0.13" width="0.4" height="0.26" rx="0.05" fill={KEY_FILL[k.color]} />
            <rect x="-0.14" y="-0.05" width="0.14" height="0.06" rx="0.01" fill="var(--ink)" opacity="0.7" />
          </g>
        ),
      )}

      {/* loot */}
      {def.loot.map((l, i) =>
        scene.lootTaken[i] ? null : (
          <g key={i} transform={`translate(${l.x + 0.5} ${l.y + 0.5})`}>
            <g className="loot-pulse" filter="url(#glow-strong)">
              <path d="M0 -0.3L0.26 0L0 0.3L-0.26 0Z" fill="var(--gold)" />
              <path d="M0 -0.3L0.1 0L0 0.3L-0.26 0Z" fill="#fff" opacity="0.35" />
            </g>
          </g>
        ),
      )}

      {/* bodies */}
      {scene.bodies.map((b) => (
        <g key={b.guard} transform={`translate(${b.x + 0.5} ${b.y + 0.5})`} opacity="0.9">
          <circle r="0.26" fill="var(--ink-2)" stroke={bodyHighlight === b.guard ? "var(--alarm)" : "var(--faint)"} strokeWidth="0.05" />
          <path d="M-0.1 -0.1L0.1 0.1M0.1 -0.1L-0.1 0.1" stroke="var(--dim)" strokeWidth="0.05" strokeLinecap="round" />
        </g>
      ))}

      {/* patrol preview for an inspected guard */}
      {inspectedGuard && (
        <g aria-hidden pointerEvents="none">
          <polyline
            points={[...inspectedGuard.route, inspectedGuard.route[0]].map((s) => `${s.x + 0.5},${s.y + 0.5}`).join(" ")}
            fill="none"
            stroke="var(--cyan)"
            strokeWidth="0.04"
            strokeDasharray="0.14 0.1"
            className="dash-march"
            opacity="0.85"
          />
          {inspectedGuard.route.map((s, i) => {
            const now = ((t % inspectedGuard.route.length) + inspectedGuard.route.length) % inspectedGuard.route.length;
            const ahead = (i - now + inspectedGuard.route.length) % inspectedGuard.route.length;
            if (ahead === 0 || ahead > 9) return null;
            return (
              <text key={i} x={s.x + 0.5} y={s.y + 0.62} fontSize="0.3" textAnchor="middle" fill="var(--cyan)" fontFamily="var(--font-mono)" opacity={1 - ahead / 12}>
                {ahead}
              </text>
            );
          })}
        </g>
      )}

      {/* cameras */}
      {def.cameras.map((c, i) => {
        const cw = world.cameras[i];
        const angle = angleAt(geo.cameraAngles.get(c.id)!, t);
        const hl = sourceHighlight === c.id;
        return (
          <g
            key={c.id}
            transform={`translate(${c.x + 0.5} ${c.y + 0.5})`}
            onPointerEnter={onInspect ? () => onInspect({ kind: "camera", id: c.id }) : undefined}
            onPointerLeave={onInspect ? () => onInspect(null) : undefined}
            className="cursor-help"
          >
            <circle r="0.45" fill="transparent" />
            {hl && <circle r="0.48" fill="none" stroke="var(--alarm)" strokeWidth="0.06" filter="url(#glow-strong)" className="laser-live" />}
            <g className="actor" style={{ transform: `rotate(${angle}deg)` }}>
              <rect x="-0.2" y="-0.13" width="0.3" height="0.26" rx="0.05" fill="var(--ink-2)" stroke={cw.off ? "var(--faint)" : "var(--amber)"} strokeWidth="0.05" />
              <path d="M0.1 -0.09L0.3 -0.15V0.15L0.1 0.09Z" fill={cw.off ? "var(--faint)" : "var(--amber)"} filter={cw.off ? undefined : "url(#glow)"} />
              {!cw.off && <circle cx="-0.08" cy="0" r="0.035" fill="var(--alarm)" className="laser-live" />}
            </g>
          </g>
        );
      })}
      {inspectedCamera && (
        <g pointerEvents="none" aria-hidden>
          {inspectedCamera.dirs.map((d, i) => {
            const now = ((t % inspectedCamera.dirs.length) + inspectedCamera.dirs.length) % inspectedCamera.dirs.length;
            const ahead = (i - now + inspectedCamera.dirs.length) % inspectedCamera.dirs.length;
            if (ahead === 0 || ahead > 4) return null;
            const v = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[d];
            return (
              <text key={i} x={inspectedCamera.x + 0.5 + v[0] * (0.5 + ahead * 0.3)} y={inspectedCamera.y + 0.6 + v[1] * (0.5 + ahead * 0.3)} fontSize="0.26" textAnchor="middle" fill="var(--amber)" fontFamily="var(--font-mono)">
                {ahead}
              </text>
            );
          })}
        </g>
      )}

      {/* guards */}
      {def.guards.map((g, i) => {
        if (downIds.has(g.id)) return null;
        const gw = world.guards[i];
        const next = scene.nextWorld.guards[i];
        const angle = angleAt(geo.guardAngles.get(g.id)!, t);
        const hl = sourceHighlight === g.id;
        return (
          <g key={g.id}>
            {forecast && (next.x !== gw.x || next.y !== gw.y) && (
              <circle cx={next.x + 0.5} cy={next.y + 0.5} r="0.24" fill="none" stroke="var(--alarm)" strokeWidth="0.03" strokeDasharray="0.06 0.06" opacity="0.8" />
            )}
            <g
              className="actor cursor-help"
              style={{ transform: `translate(${gw.x + 0.5}px, ${gw.y + 0.5}px)` }}
              onPointerEnter={onInspect ? () => onInspect({ kind: "guard", id: g.id }) : undefined}
              onPointerLeave={onInspect ? () => onInspect(null) : undefined}
            >
              <circle r="0.45" fill="transparent" />
              {hl && <circle r="0.44" fill="none" stroke="var(--alarm)" strokeWidth="0.07" filter="url(#glow-strong)" className="laser-live" />}
              <g className="actor" style={{ transform: `rotate(${angle}deg)` }}>
                {g.armored && <path d="M0.36 0L0.18 0.31L-0.18 0.31L-0.36 0L-0.18 -0.31L0.18 -0.31Z" fill="none" stroke="var(--alarm)" strokeWidth="0.04" opacity="0.8" />}
                <circle r="0.25" fill="var(--ink)" stroke="var(--alarm)" strokeWidth="0.06" filter="url(#glow)" />
                <path d="M0.05 -0.13L0.2 0L0.05 0.13" fill="none" stroke="var(--alarm)" strokeWidth="0.07" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </g>
          </g>
        );
      })}

      {/* the thief */}
      {!hideThief && scene.thief && (
        <g aria-hidden>
          {trail.map((p, i) => (
            <circle key={`${i}-${p.x}-${p.y}`} cx={p.x + 0.5} cy={p.y + 0.5} r={0.05 + (i / Math.max(1, trail.length)) * 0.06} fill="var(--mint)" opacity={0.12 + (i / Math.max(1, trail.length)) * 0.3} />
          ))}
          <g className="actor" style={{ transform: `translate(${scene.thief.x + 0.5}px, ${scene.thief.y + 0.5}px)` }}>
            <circle r="0.62" fill="url(#thiefGlow)" />
            <circle r="0.24" fill="var(--mint)" filter="url(#glow-strong)" />
            <circle r="0.09" fill="var(--ink)" />
            {caught && <circle r="0.4" fill="none" stroke="var(--alarm)" strokeWidth="0.06" className="laser-live" />}
          </g>
        </g>
      )}

      {/* sight line from whoever caught you */}
      {caught && scene.thief && sourceHighlight && (() => {
        const src = world.guards.find((g) => g.id === sourceHighlight) ?? world.cameras.find((c) => c.id === sourceHighlight);
        if (!src) return null;
        const target = caught.kind === "body" ? scene.bodies.find((b) => b.guard === caught.id) ?? scene.thief : scene.thief;
        return (
          <line x1={src.x + 0.5} y1={src.y + 0.5} x2={target.x + 0.5} y2={target.y + 0.5} stroke="var(--alarm)" strokeWidth="0.05" strokeDasharray="0.12 0.08" className="dash-march" filter="url(#glow)" />
        );
      })()}

      {/* one-shot effects */}
      {fx.map((f) => {
        const cx = f.at.x + 0.5;
        const cy = f.at.y + 0.5;
        if (f.kind === "emp") return <circle key={f.id} cx={cx} cy={cy} r={Math.max(w, h)} fill="none" stroke="var(--emp)" strokeWidth="0.12" className="emp-ring" filter="url(#glow-strong)" />;
        if (f.kind === "loot" || f.kind === "key")
          return (
            <g key={f.id} transform={`translate(${cx} ${cy})`}>
              <circle r="1.2" fill="none" stroke={f.kind === "loot" ? "var(--gold)" : "var(--cyan)"} strokeWidth="0.08" className="emp-ring" />
              <circle r="0.7" fill="none" stroke="#fff" strokeWidth="0.04" className="emp-ring" style={{ animationDelay: "0.08s" }} />
            </g>
          );
        if (f.kind === "takedown") return <circle key={f.id} cx={cx} cy={cy} r="1" fill="none" stroke="var(--paper)" strokeWidth="0.1" className="emp-ring" />;
        return <circle key={f.id} cx={cx} cy={cy} r="0.9" fill="none" stroke="var(--cyan)" strokeWidth="0.06" className="emp-ring" />;
      })}

      {overlay}
    </svg>
  );
}

export const Board = memo(BoardImpl);

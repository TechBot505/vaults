"use client";

import type { ReactNode } from "react";
import { Minus, Plus, Trash2, X, Shield, Repeat, ArrowLeftRight } from "lucide-react";
import type { Dir } from "@/engine/types";
import { LIMITS } from "@/engine/validate";
import { useEditor } from "@/editor/store";
import { removeGuard, resize, updateCamera, updateGuard, updateLaser, type EditorDoc, type EditorGuard } from "@/editor/doc";
import type { Waypoint } from "@/engine/build";

const DIRS: Dir[] = ["N", "E", "S", "W"];
const ARROW: Record<Dir, string> = { N: "↑", E: "→", S: "↓", W: "←" };

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-ink2/60 p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="label text-cyan">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Stepper({ value, min, max, onChange, label, format }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string; format?: (n: number) => string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-dim">{label}</span>
      <div className="flex items-center gap-1">
        <button className="press grid h-6 w-6 place-items-center rounded border border-line text-dim hover:text-paper disabled:opacity-30" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`less ${label}`}>
          <Minus size={12} />
        </button>
        <span className="w-12 text-center font-mono text-paper">{format ? format(value) : value}</span>
        <button className="press grid h-6 w-6 place-items-center rounded border border-line text-dim hover:text-paper disabled:opacity-30" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`more ${label}`}>
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

/** A repeating direction sequence (camera sweep, a guard looking around). */
function DirSequence({ value, onChange, max = 16, allowEmpty = false }: { value: Dir[]; onChange: (d: Dir[]) => void; max?: number; allowEmpty?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-7 flex-wrap items-center gap-1 rounded-md border border-line bg-ink px-1.5 py-1">
        {value.length === 0 && <span className="px-1 font-mono text-xs text-faint">faces where it walks</span>}
        {value.map((d, i) => (
          <button
            key={i}
            onClick={() => (value.length > 1 || allowEmpty) && onChange(value.filter((_, j) => j !== i))}
            className="press grid h-6 w-6 place-items-center rounded bg-ink3 font-mono text-sm text-paper hover:bg-alarm/30"
            title="Remove"
          >
            {ARROW[d]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        {DIRS.map((d) => (
          <button key={d} disabled={value.length >= max} onClick={() => onChange([...value, d])} className="press h-7 flex-1 rounded border border-line font-mono text-sm text-dim hover:border-cyan/50 hover:text-paper disabled:opacity-30" aria-label={`add ${d}`}>
            +{ARROW[d]}
          </button>
        ))}
      </div>
    </div>
  );
}

function GuardPanel({ g }: { g: EditorGuard }) {
  const doc = useEditor((s) => s.doc);
  const commit = useEditor((s) => s.commit);
  const select = useEditor((s) => s.select);
  const set = (patch: Partial<EditorGuard>, merge = false) => commit(updateGuard(useEditor.getState().doc, g.id, patch), merge);
  const setWp = (i: number, patch: Partial<Waypoint>) => set({ waypoints: g.waypoints.map((w, j) => (j === i ? { ...w, ...patch } : w)) });
  const stationary = g.waypoints.length === 1;

  return (
    <Section
      title={`guard ${g.id}`}
      right={
        <button onClick={() => select(null)} className="press text-faint hover:text-paper" aria-label="Deselect">
          <X size={14} />
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <Stepper label="sight range" value={g.range} min={1} max={LIMITS.maxGuardRange} onChange={(range) => set({ range })} />
        <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-1.5 text-dim">
            <Shield size={13} /> armored
          </span>
          <input type="checkbox" checked={g.armored} onChange={(e) => set({ armored: e.target.checked })} className="h-4 w-4 accent-[var(--alarm)]" />
        </label>
        <p className="-mt-1.5 text-xs text-faint">Armored guards can&apos;t be taken down. Walk into one and you&apos;re caught.</p>

        {g.raw && (
          <p className="rounded-md border border-amber/30 bg-amber/5 px-2.5 py-2 text-xs text-amber">
            Exact patrol copied from the original vault. Adding or changing waypoints will re-route it.
          </p>
        )}

        {stationary ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-dim">posted guard · looks</span>
            <DirSequence value={g.waypoints[0].look ?? ["S"]} onChange={(look) => setWp(0, { look, wait: look.length })} />
            <p className="text-xs text-faint">One direction per turn, repeating. With the guard tool selected, click floor to give them a patrol.</p>
          </div>
        ) : (
          <>
            <div className="flex overflow-hidden rounded-md border border-line font-mono text-xs">
              {(
                [
                  ["loop", <Repeat key="l" size={12} />, "loop"],
                  ["pingpong", <ArrowLeftRight key="p" size={12} />, "back & forth"],
                ] as const
              ).map(([m, icon, label]) => (
                <button key={m} onClick={() => set({ mode: m })} className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 ${g.mode === m ? "bg-paper text-ink" : "text-dim hover:text-paper"}`}>
                  {icon} {label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-dim">waypoints</span>
              <ol className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1">
                {g.waypoints.map((w, i) => (
                  <li key={i} className="rounded-md border border-line bg-ink px-2 py-1.5">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="grid h-5 w-5 place-items-center rounded-full border border-cyan text-[0.65rem] text-cyan">{i + 1}</span>
                      <span className="text-dim">
                        {w.x},{w.y}
                      </span>
                      <span className="ml-auto text-faint">wait</span>
                      <button className="press text-dim hover:text-paper disabled:opacity-30" disabled={!w.wait} onClick={() => setWp(i, { wait: Math.max(0, (w.wait ?? 0) - 1), look: (w.look ?? []).slice(0, Math.max(0, (w.wait ?? 0) - 1)) })} aria-label="shorter wait">
                        <Minus size={12} />
                      </button>
                      <span className="w-4 text-center text-paper">{w.wait ?? 0}</span>
                      <button className="press text-dim hover:text-paper disabled:opacity-30" disabled={(w.wait ?? 0) >= 12} onClick={() => setWp(i, { wait: (w.wait ?? 0) + 1 })} aria-label="longer wait">
                        <Plus size={12} />
                      </button>
                      <button
                        className="press ml-1 text-faint hover:text-alarm disabled:opacity-30"
                        disabled={g.waypoints.length <= 1}
                        onClick={() => set({ waypoints: g.waypoints.filter((_, j) => j !== i) })}
                        aria-label="remove waypoint"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    {(w.wait ?? 0) > 0 && (
                      <div className="mt-1.5">
                        <DirSequence value={w.look ?? []} allowEmpty max={12} onChange={(look) => setWp(i, { look })} />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
              <p className="text-xs text-faint">Guards walk the shortest path between waypoints. Waits can look around: one direction per turn.</p>
            </div>
          </>
        )}
        <button
          onClick={() => {
            commit(removeGuard(doc, g.id));
            select(null);
          }}
          className="press flex items-center justify-center gap-1.5 rounded-md border border-alarm/40 py-1.5 text-xs text-alarm hover:bg-alarm/10"
        >
          <Trash2 size={13} /> remove guard
        </button>
      </div>
    </Section>
  );
}

function CameraPanel({ id }: { id: string }) {
  const doc = useEditor((s) => s.doc);
  const commit = useEditor((s) => s.commit);
  const select = useEditor((s) => s.select);
  const c = doc.cameras.find((x) => x.id === id);
  if (!c) return null;
  const set = (patch: Parameters<typeof updateCamera>[2]) => commit(updateCamera(useEditor.getState().doc, id, patch));
  const presets: [string, Dir[]][] = [
    ["fixed", [c.dirs[0]]],
    ["sweep", sweep(c.dirs[0])],
    ["spin", spin(c.dirs[0])],
  ];
  return (
    <Section
      title={`camera ${c.id}`}
      right={
        <button onClick={() => select(null)} className="press text-faint hover:text-paper" aria-label="Deselect">
          <X size={14} />
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <Stepper label="range" value={c.range} min={1} max={LIMITS.maxCameraRange} onChange={(range) => set({ range })} />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-dim">facing, turn by turn</span>
          <DirSequence value={c.dirs} max={LIMITS.maxCameraDirs} onChange={(dirs) => set({ dirs })} />
          <div className="flex gap-1">
            {presets.map(([name, dirs]) => (
              <button key={name} onClick={() => set({ dirs })} className="press flex-1 rounded border border-line py-1 font-mono text-[0.7rem] text-dim hover:text-paper">
                {name}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => {
            commit({ ...doc, cameras: doc.cameras.filter((x) => x.id !== id) });
            select(null);
          }}
          className="press flex items-center justify-center gap-1.5 rounded-md border border-alarm/40 py-1.5 text-xs text-alarm hover:bg-alarm/10"
        >
          <Trash2 size={13} /> remove camera
        </button>
      </div>
    </Section>
  );
}

const RIGHT: Record<Dir, Dir> = { N: "E", E: "S", S: "W", W: "N" };
const LEFT: Record<Dir, Dir> = { N: "W", E: "N", S: "E", W: "S" };
function sweep(d: Dir): Dir[] {
  return [LEFT[d], LEFT[d], d, RIGHT[d], RIGHT[d], d];
}
function spin(d: Dir): Dir[] {
  return [d, RIGHT[d], RIGHT[RIGHT[d]], LEFT[d]];
}

function LaserPanel({ id }: { id: string }) {
  const doc = useEditor((s) => s.doc);
  const commit = useEditor((s) => s.commit);
  const select = useEditor((s) => s.select);
  const l = doc.lasers.find((x) => x.id === id);
  if (!l) return null;
  const setPattern = (pattern: string) => commit(updateLaser(useEditor.getState().doc, id, { pattern }));
  return (
    <Section
      title={`laser ${l.id}`}
      right={
        <button onClick={() => select(null)} className="press text-faint hover:text-paper" aria-label="Deselect">
          <X size={14} />
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <span className="text-sm text-dim">on / off, turn by turn</span>
        <div className="flex flex-wrap gap-1">
          {l.pattern.split("").map((ch, i) => (
            <button
              key={i}
              onClick={() => setPattern(l.pattern.slice(0, i) + (ch === "1" ? "0" : "1") + l.pattern.slice(i + 1))}
              className={`press h-8 w-8 rounded font-mono text-xs transition-colors ${ch === "1" ? "bg-laser text-ink shadow-[0_0_12px_-2px_var(--laser)]" : "border border-line text-faint"}`}
              aria-label={`turn ${i}: ${ch === "1" ? "on" : "off"}`}
            >
              {ch === "1" ? "on" : "off"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button disabled={l.pattern.length <= 1} onClick={() => setPattern(l.pattern.slice(0, -1))} className="press flex-1 rounded border border-line py-1 font-mono text-xs text-dim hover:text-paper disabled:opacity-30">
            − turn
          </button>
          <button disabled={l.pattern.length >= LIMITS.maxPattern} onClick={() => setPattern(l.pattern + "0")} className="press flex-1 rounded border border-line py-1 font-mono text-xs text-dim hover:text-paper disabled:opacity-30">
            + turn
          </button>
          <button onClick={() => setPattern("1")} className="press flex-1 rounded border border-line py-1 font-mono text-xs text-dim hover:text-paper">
            always on
          </button>
        </div>
        {!l.pattern.includes("1") && <p className="text-xs text-alarm">A laser that&apos;s never on does nothing.</p>}
        <button
          onClick={() => {
            commit({ ...doc, lasers: doc.lasers.filter((x) => x.id !== id) });
            select(null);
          }}
          className="press flex items-center justify-center gap-1.5 rounded-md border border-alarm/40 py-1.5 text-xs text-alarm hover:bg-alarm/10"
        >
          <Trash2 size={13} /> remove laser
        </button>
      </div>
    </Section>
  );
}

function VaultPanel({ doc }: { doc: EditorDoc }) {
  const commit = useEditor((s) => s.commit);
  return (
    <Section title="vault">
      <div className="flex flex-col gap-3">
        <Stepper label="width" value={doc.w} min={LIMITS.minW} max={LIMITS.maxW} onChange={(w) => commit(resize(doc, w, doc.h))} />
        <Stepper label="height" value={doc.h} min={LIMITS.minH} max={LIMITS.maxH} onChange={(h) => commit(resize(doc, doc.w, h))} />
        <Stepper label="EMP charges" value={doc.emp} min={0} max={LIMITS.maxEmp} onChange={(emp) => commit({ ...doc, emp })} />
        <Stepper
          label="turn limit"
          value={doc.maxTurns}
          min={0}
          max={LIMITS.maxTurns}
          format={(n) => (n === 0 ? "none" : String(n))}
          onChange={(n) => {
            // step in fives past the first few turns: nobody wants to click 200 times
            const prev = doc.maxTurns;
            const next = n > prev ? (prev === 0 ? 20 : prev + 5) : prev <= 20 ? 0 : prev - 5;
            commit({ ...doc, maxTurns: Math.min(LIMITS.maxTurns, next) });
          }}
        />
        <p className="text-xs text-faint">An EMP knocks out cameras and lasers for 3 turns. Guards don&apos;t care.</p>
      </div>
    </Section>
  );
}

export function Inspector() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const g = selection?.kind === "guard" ? doc.guards.find((x) => x.id === selection.id) : undefined;
  if (g) return <GuardPanel key={g.id} g={g} />;
  if (selection?.kind === "camera" && doc.cameras.some((c) => c.id === selection.id)) return <CameraPanel id={selection.id} />;
  if (selection?.kind === "laser" && doc.lasers.some((l) => l.id === selection.id)) return <LaserPanel id={selection.id} />;
  return <VaultPanel doc={doc} />;
}

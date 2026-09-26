"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { Level } from "@/engine/geometry";
import { newGame, step } from "@/engine/game";
import type { Action, GameState, Pt, VaultDef } from "@/engine/types";
import { Board } from "./Board";
import { sceneFor } from "./scene";
import { useTileSize } from "./useTileSize";
import { caughtHeadline } from "@/lib/copy";

/** Watch any run (a crack, a capture, the Machine's route) turn by turn. */
export function ReplayView({ def, moves, autoplay = true, label, maxTile = 48, height = "56vh" }: { def: VaultDef; moves: string; autoplay?: boolean; label?: string; maxTile?: number; height?: string }) {
  const level = useMemo(() => new Level(def), [def]);
  const states = useMemo(() => {
    const out: GameState[] = [newGame(def)];
    for (const m of moves) {
      const r = step(level, out[out.length - 1], m as Action);
      if (!r.ok) break;
      out.push(r.state);
      if (r.state.status !== "playing") break;
    }
    return out;
  }, [def, level, moves]);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const [speed, setSpeed] = useState(1);
  const { ref, tile } = useTileSize(def.w, def.h, { max: maxTile });

  // restart when the run changes
  const [seen, setSeen] = useState(moves);
  if (seen !== moves) {
    setSeen(moves);
    setI(0);
    setPlaying(autoplay);
  }

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setI((n) => {
        if (n >= states.length - 1) {
          setPlaying(false);
          return n;
        }
        return n + 1;
      });
    }, 260 / speed);
    return () => clearInterval(id);
  }, [playing, speed, states.length]);

  const s = states[Math.min(i, states.length - 1)];
  const trail: Pt[] = states.slice(Math.max(0, i - 7), i).map((x) => x.pos);
  const end = states[states.length - 1];

  return (
    <div className="flex w-full flex-col gap-3">
      <div ref={ref} className="flex w-full items-center justify-center" style={{ height }}>
        <Board level={level} scene={sceneFor(level, s)} tile={tile} trail={trail} caught={s.caught ?? null} stepMs={Math.round(200 / speed)} ariaLabel={label ?? "Replay"} />
      </div>
      <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-dim">
        <button onClick={() => { setI(0); setPlaying(false); }} className="press text-dim hover:text-paper" aria-label="To start"><SkipBack size={15} /></button>
        <button
          onClick={() => {
            if (i >= states.length - 1) setI(0);
            setPlaying((p) => !p || i >= states.length - 1);
          }}
          className="press grid h-9 w-9 place-items-center rounded-full bg-paper text-ink"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={15} /> : i >= states.length - 1 ? <RotateCcw size={15} /> : <Play size={15} />}
        </button>
        <button onClick={() => { setI(states.length - 1); setPlaying(false); }} className="press text-dim hover:text-paper" aria-label="To end"><SkipForward size={15} /></button>
        <input
          type="range"
          min={0}
          max={states.length - 1}
          value={i}
          onChange={(e) => { setI(Number(e.target.value)); setPlaying(false); }}
          className="min-w-[8rem] flex-1 accent-[var(--cyan)]"
          aria-label="Replay position"
        />
        <span className="w-20 text-right text-paper">turn {s.t}/{end.t}</span>
        <div className="flex overflow-hidden rounded-md border border-line">
          {[1, 2, 4].map((x) => (
            <button key={x} onClick={() => setSpeed(x)} className={`px-2 py-1 ${speed === x ? "bg-paper text-ink" : "hover:text-paper"}`}>
              {x}×
            </button>
          ))}
        </div>
      </div>
      {i === states.length - 1 && (
        <div className="text-center font-mono text-xs">
          {end.status === "cracked" ? <span className="text-gold">cracked in {end.t} turns</span> : end.status === "caught" ? <span className="text-alarm">{caughtHeadline(end.caught).title.toLowerCase()} on turn {end.t}</span> : <span className="text-dim">run ended on turn {end.t}</span>}
        </div>
      )}
    </div>
  );
}

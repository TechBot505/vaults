"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Board } from "@/components/board/Board";
import { sceneFor } from "@/components/board/scene";
import { useTileSize } from "@/components/board/useTileSize";
import { Level } from "@/engine/geometry";
import { newGame, step } from "@/engine/game";
import type { Action, GameState, Pt, VaultDef } from "@/engine/types";
import { useMediaQuery } from "@/lib/hooks";

/** The Machine cracking a vault on a loop: the home page's moving picture. */
export function DemoLoop({ def, moves, label }: { def: VaultDef; moves: string; label: string }) {
  const level = useMemo(() => new Level(def), [def]);
  const states = useMemo(() => {
    const out: GameState[] = [newGame(def)];
    for (const m of moves) {
      const r = step(level, out[out.length - 1], m as Action);
      if (!r.ok) break;
      out.push(r.state);
    }
    return out;
  }, [def, level, moves]);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [i, setI] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const { ref, tile } = useTileSize(def.w, def.h, { max: 40, min: 10 });

  // only animate while on screen
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !visible) return;
    const end = states.length - 1;
    const id = setTimeout(() => setI((n) => (n >= end ? 0 : n + 1)), i >= end ? 2200 : i === 0 ? 900 : 230);
    return () => clearTimeout(id);
  }, [i, reduced, visible, states.length]);

  const shown = reduced ? states.length - 1 : i;
  const s = states[shown];
  const trail: Pt[] = states.slice(Math.max(0, shown - 7), shown).map((x) => x.pos);
  const done = s.status === "cracked";

  return (
    <div ref={box} className="relative w-full">
      <div ref={ref} className="flex aspect-[17/10] w-full items-center justify-center">
        <Board level={level} scene={sceneFor(level, s)} tile={tile} trail={trail} stepMs={210} ariaLabel={label} />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[0.68rem] text-faint">
        <span>{label}</span>
        <span className={done ? "text-gold" : "text-dim"}>
          {done ? "cracked" : "turn"} {s.t}
        </span>
      </div>
    </div>
  );
}

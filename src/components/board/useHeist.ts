"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Level } from "@/engine/geometry";
import { newGame, step } from "@/engine/game";
import type { Action, GameEvent, GameState, Pt, VaultDef } from "@/engine/types";
import type { Fx } from "./Board";
import { sfx, primeAudio } from "@/lib/sound";

let fxId = 1;

export interface HeistController {
  level: Level;
  state: GameState;
  trail: Pt[];
  fx: Fx[];
  attempt: number;
  shake: number;
  act: (a: Action) => boolean;
  restart: () => void;
  lastEvents: GameEvent[];
}

/**
 * Game loop for one vault: applies actions through the engine, keeps a short
 * trail, turns engine events into sounds and visual effects.
 */
export function useHeist(def: VaultDef, opts: { onEnd?: (s: GameState, ms: number) => void; onAttempt?: (s: GameState) => void } = {}): HeistController {
  const level = useMemo(() => new Level(def), [def]);
  const [state, setState] = useState<GameState>(() => newGame(def));
  const [trail, setTrail] = useState<Pt[]>([]);
  const [fx, setFx] = useState<Fx[]>([]);
  const [attempt, setAttempt] = useState(1);
  const [shake, setShake] = useState(0);
  const [lastEvents, setLastEvents] = useState<GameEvent[]>([]);
  const stateRef = useRef(state);
  /** when the current run's first move was made (for the server's sanity check on run speed) */
  const startedAt = useRef(0);
  const optsRef = useRef(opts);
  useLayoutEffect(() => {
    stateRef.current = state;
    optsRef.current = opts;
  });

  // reset when the vault itself changes
  const [defSeen, setDefSeen] = useState(def);
  if (defSeen !== def) {
    setDefSeen(def);
    setState(newGame(def));
    setTrail([]);
    setFx([]);
    setAttempt(1);
  }

  const pushFx = useCallback((kind: Fx["kind"], at: Pt) => {
    const f: Fx = { id: fxId++, kind, at };
    setFx((list) => [...list.slice(-6), f]);
    setTimeout(() => setFx((list) => list.filter((x) => x.id !== f.id)), 1000);
  }, []);

  const act = useCallback(
    (a: Action): boolean => {
      primeAudio();
      const cur = stateRef.current;
      if (cur.status !== "playing") return false;
      const r = step(level, cur, a);
      if (r.ok && cur.moves.length === 0) startedAt.current = Date.now();
      if (!r.ok) {
        if (r.reason !== "over") sfx("blocked");
        return false;
      }
      const next = r.state;
      stateRef.current = next;
      setState(next);
      setLastEvents(r.events);
      setTrail((tr) => (next.pos.x !== cur.pos.x || next.pos.y !== cur.pos.y ? [...tr.slice(-7), cur.pos] : tr));
      for (const e of r.events) {
        if (e.type === "move") sfx("step");
        else if (e.type === "wait") sfx("wait");
        else if (e.type === "emp") {
          sfx("emp");
          pushFx("emp", next.pos);
        } else if (e.type === "loot") {
          sfx("loot");
          pushFx("loot", e.at);
        } else if (e.type === "key") {
          sfx("key");
          pushFx("key", e.at);
        } else if (e.type === "door") {
          sfx("door");
          pushFx("door", e.at);
        } else if (e.type === "takedown") {
          sfx("takedown");
          pushFx("takedown", e.at);
        } else if (e.type === "caught") {
          sfx("caught");
          setShake((n) => n + 1);
        } else if (e.type === "cracked") sfx("cracked");
      }
      if (next.status !== "playing") optsRef.current.onEnd?.(next, Date.now() - startedAt.current);
      return true;
    },
    [level, pushFx],
  );

  const restart = useCallback(() => {
    const cur = stateRef.current;
    if (cur.moves.length > 0 && cur.status === "playing") optsRef.current.onAttempt?.(cur);
    const fresh = newGame(def);
    stateRef.current = fresh;
    setState(fresh);
    setTrail([]);
    setFx([]);
    setLastEvents([]);
    if (cur.moves.length > 0) setAttempt((n) => n + 1);
  }, [def]);

  return { level, state, trail, fx, attempt, shake, act, restart, lastEvents };
}

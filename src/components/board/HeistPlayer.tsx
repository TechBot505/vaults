"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff, RotateCcw, Zap, Gem, KeyRound, Timer, Volume2, VolumeX, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Hourglass } from "lucide-react";
import { Board, type Inspect } from "./Board";
import { sceneFor } from "./scene";
import { useHeist } from "./useHeist";
import { useTileSize } from "./useTileSize";
import type { Action, GameState, VaultDef } from "@/engine/types";
import { useSettings } from "@/stores/settings";
import { caughtHeadline } from "@/lib/copy";
import { useMediaQuery } from "@/lib/hooks";
import { laserPhaseOn } from "@/engine/geometry";

export interface HeistPlayerProps {
  def: VaultDef;
  title: string;
  kicker?: string;
  par?: number | null;
  intro?: ReactNode;
  /** rendered in the cracked panel (share buttons, next heist…) */
  crackedActions?: (s: GameState) => ReactNode;
  caughtActions?: (s: GameState) => ReactNode;
  /** a run ended; `ms` is how long it took from the first move */
  onEnd?: (s: GameState, attempt: number, ms: number) => void;
  /** a run abandoned with a restart */
  onAbandon?: (s: GameState, attempt: number) => void;
}

const KEYMAP: Record<string, Action> = {
  ArrowUp: "U",
  ArrowDown: "D",
  ArrowLeft: "L",
  ArrowRight: "R",
  w: "U",
  s: "D",
  a: "L",
  d: "R",
  W: "U",
  S: "D",
  A: "L",
  D: "R",
  " ": "W",
  ".": "W",
  e: "E",
  E: "E",
};

export function HeistPlayer({ def, title, kicker, par, intro, crackedActions, caughtActions, onEnd, onAbandon }: HeistPlayerProps) {
  const settings = useSettings();
  const stepMs = settings.speed === "fast" ? 90 : 150;
  const attemptRef = useRef(1);
  const game = useHeist(def, {
    onEnd: (s, ms) => onEnd?.(s, attemptRef.current, ms),
    onAttempt: (s) => onAbandon?.(s, attemptRef.current),
  });
  useEffect(() => {
    attemptRef.current = game.attempt;
  }, [game.attempt]);
  const { state, level } = game;
  const [inspect, setInspect] = useState<Inspect>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const lastAct = useRef(0);
  const touch = useMediaQuery("(pointer: coarse)");
  const { ref: boxRef, tile } = useTileSize(def.w, def.h, { max: 58 });
  const scene = sceneFor(level, state);

  const tryAct = useCallback(
    (a: Action) => {
      const now = performance.now();
      if (now - lastAct.current < stepMs * 0.55) return;
      if (game.act(a)) lastAct.current = now;
    },
    [game, stepMs],
  );

  // screen shake on capture (Web Animations: no re-render needed)
  useEffect(() => {
    if (!game.shake || !useSettings.getState().effects) return;
    shakeRef.current?.animate(
      [
        { transform: "translate(0,0)" },
        { transform: "translate(-6px,2px)" },
        { transform: "translate(5px,-3px)" },
        { transform: "translate(-4px,3px)" },
        { transform: "translate(3px,-1px)" },
        { transform: "translate(-1px,1px)" },
        { transform: "translate(0,0)" },
      ],
      { duration: 450, easing: "ease-out" },
    );
  }, [game.shake]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "r" || e.key === "R" || (e.key === "Enter" && state.status !== "playing")) {
        e.preventDefault();
        game.restart();
        return;
      }
      if (e.key === "f" || e.key === "F") {
        settings.set({ forecast: !useSettings.getState().forecast });
        return;
      }
      const a = KEYMAP[e.key];
      if (!a) return;
      e.preventDefault();
      tryAct(a);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, tryAct, state.status, settings]);

  // swipe to move on touch screens
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    tryAct(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "R" : "L") : dy > 0 ? "D" : "U");
  };

  const lootGot = state.loot.filter(Boolean).length;
  const over = state.status !== "playing";
  const headline = caughtHeadline(state.caught);

  const inspectInfo = (() => {
    if (!inspect) return null;
    if (inspect.kind === "guard") {
      const g = def.guards.find((x) => x.id === inspect.id);
      if (!g) return null;
      return `Guard · sees ${g.range} tile${g.range > 1 ? "s" : ""} ahead · patrol repeats every ${g.route.length} turn${g.route.length > 1 ? "s" : ""}${g.armored ? " · ARMORED: can't be taken down" : " · can be taken down from behind or the side"}`;
    }
    if (inspect.kind === "camera") {
      const c = def.cameras.find((x) => x.id === inspect.id);
      if (!c) return null;
      return `Camera · range ${c.range} · turns ${c.dirs.join(" → ")} · EMP knocks it out`;
    }
    const l = def.lasers.find((x) => x.id === inspect.id);
    if (!l) return null;
    return (
      <span className="inline-flex items-center gap-2">
        Laser · pattern
        <span className="inline-flex gap-0.5">
          {l.pattern.split("").map((p, i) => {
            const now = ((state.t % l.pattern.length) + l.pattern.length) % l.pattern.length === i;
            return <span key={i} className={`inline-block h-3 w-2 rounded-sm ${p === "1" ? "bg-laser" : "bg-line"} ${now ? "ring-1 ring-paper" : ""}`} />;
          })}
        </span>
        {laserPhaseOn(l, state.t + 1) ? "· live next turn" : "· off next turn"}
      </span>
    );
  })();

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* HUD */}
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-end justify-between gap-4 px-4 pb-3 sm:px-6">
        <div>
          {kicker && <div className="label text-cyan">{kicker}</div>}
          <h1 className="display mt-1 text-2xl text-paper sm:text-3xl">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <Chip icon={<Timer size={13} />} label="turn">
            <span className="text-paper">{state.t}</span>
            {def.maxTurns > 0 && <span className={def.maxTurns - state.t <= 5 ? "text-alarm" : "text-dim"}>/{def.maxTurns}</span>}
          </Chip>
          <Chip icon={<Gem size={13} className="text-gold" />} label="loot">
            <span className={lootGot === def.loot.length ? "text-gold" : "text-paper"}>
              {lootGot}/{def.loot.length}
            </span>
          </Chip>
          {def.keys.length > 0 && (
            <Chip icon={<KeyRound size={13} />} label="keys">
              {(["red", "blue", "gold"] as const)
                .filter((c) => def.keys.some((k) => k.color === c))
                .map((c) => (
                  <span key={c} className="inline-block h-2.5 w-3.5 rounded-sm" style={{ background: `var(--${c}-key)`, opacity: state.keys.includes(c) ? 1 : 0.18 }} />
                ))}
            </Chip>
          )}
          {def.emp > 0 && (
            <button onClick={() => tryAct("E")} disabled={state.empLeft === 0 || over} className="press disabled:opacity-50" title="Fire EMP (E)">
              <Chip icon={<Zap size={13} className="text-emp" />} label="emp">
                <span className="text-paper">{state.empLeft}</span>
              </Chip>
            </button>
          )}
          <button onClick={() => settings.set({ forecast: !settings.forecast })} className="press" title="Forecast next turn (F)" aria-pressed={settings.forecast}>
            <Chip icon={settings.forecast ? <Eye size={13} className="text-cyan" /> : <EyeOff size={13} />} label="forecast" />
          </button>
          <button onClick={() => settings.set({ sound: !settings.sound })} className="press" title="Sound" aria-pressed={settings.sound}>
            <Chip icon={settings.sound ? <Volume2 size={13} /> : <VolumeX size={13} />} />
          </button>
          <button onClick={game.restart} className="press" title="Restart (R)">
            <Chip icon={<RotateCcw size={13} />} label="restart" />
          </button>
        </div>
      </div>

      {intro && state.t === 0 && game.attempt === 1 && <div className="mx-auto mb-3 w-full max-w-[1200px] px-4 sm:px-6">{intro}</div>}

      {/* board */}
      <div ref={boxRef} className="relative mx-auto flex min-h-[46vh] w-full max-w-[1200px] flex-1 items-center justify-center px-2" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <div ref={shakeRef} className="relative">
          <Board
            level={level}
            scene={scene}
            tile={tile}
            forecast={settings.forecast}
            caught={state.caught ?? null}
            inspect={inspect}
            onInspect={setInspect}
            trail={game.trail}
            fx={game.fx}
            stepMs={stepMs}
            ariaLabel={`${title}: vault blueprint, turn ${state.t}`}
          />
          {state.status === "caught" && settings.effects && <div key={game.attempt} className="alarm-flash pointer-events-none absolute inset-0 rounded-lg" style={{ background: "radial-gradient(circle, transparent 30%, var(--alarm))" }} />}
          {scene.world.empActive && <div className="pointer-events-none absolute inset-0 rounded-lg" style={{ boxShadow: "inset 0 0 60px color-mix(in oklab, var(--emp) 45%, transparent)" }} />}
          {over && (
            <div key={`stamp-${game.attempt}`} className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/3" aria-hidden>
              <div
                className={`stamp display border-4 bg-ink/85 px-5 py-1.5 text-4xl backdrop-blur-sm sm:text-5xl ${state.status === "cracked" ? "border-gold text-gold" : "border-alarm text-alarm"} glow-text`}
                style={{ animationDelay: state.status === "caught" ? "0.35s" : "0.15s" }}
              >
                {state.status === "cracked" ? "CRACKED" : "BUSTED"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* result panel, inspect + controls */}
      <div className="mx-auto w-full max-w-[1200px] px-4 pb-4 sm:px-6">
        <AnimatePresence mode="wait">
          {over && (
            <motion.div
              key={`end-${game.attempt}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: state.status === "caught" ? 0.5 : 0.35, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto mb-3 flex max-w-2xl flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-ink2/90 px-5 py-4 shadow-2xl backdrop-blur"
              role="dialog"
              aria-label={state.status === "cracked" ? "Vault cracked" : "Caught"}
            >
              {state.status === "caught" ? (
                <>
                  <div className="text-left">
                    <div className="font-display text-lg text-alarm">{headline.title}</div>
                    <p className="text-sm text-dim">{headline.body}</p>
                    <p className="mt-1 font-mono text-[0.7rem] text-faint">
                      attempt #{game.attempt} · caught on turn {state.t}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={game.restart} autoFocus className="press inline-flex items-center gap-2 rounded-md bg-paper px-5 py-2.5 font-mono text-sm text-ink hover:bg-cyan">
                      <RotateCcw size={15} /> try again <kbd className="!border-ink/20 !bg-transparent !text-ink/60">R</kbd>
                    </button>
                    {caughtActions?.(state)}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-left">
                    <div className="font-display text-lg text-gold">Out with the loot</div>
                    <p className="text-sm text-paper">
                      <span className="font-mono text-gold">{state.t}</span> turns
                      {game.attempt > 1 ? (
                        <>
                          {" "}· attempt <span className="font-mono text-gold">#{game.attempt}</span>
                        </>
                      ) : (
                        " · first try"
                      )}
                    </p>
                    {par ? <p className="mt-1 font-mono text-[0.7rem] text-dim">{state.t <= par ? "you matched the Machine's best route ✦" : `the Machine did it in ${par}`}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">{crackedActions?.(state)}</div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="min-h-[1.5rem] text-center font-mono text-xs text-dim" aria-live="polite">
          {inspectInfo ?? (scene.world.empActive ? <span className="text-emp">EMP active · cameras and lasers offline until turn {state.empUntil + 1}</span> : touch ? "swipe to move · tap a guard to see its route" : "hover a guard, camera or laser to study it")}
        </div>
        {touch ? (
          <div className="mt-3 flex items-center justify-center gap-3">
            <div className="grid grid-cols-3 gap-1.5">
              <span />
              <PadButton onClick={() => tryAct("U")} label="Up"><ChevronUp /></PadButton>
              <span />
              <PadButton onClick={() => tryAct("L")} label="Left"><ChevronLeft /></PadButton>
              <PadButton onClick={() => tryAct("W")} label="Wait"><Hourglass size={18} /></PadButton>
              <PadButton onClick={() => tryAct("R")} label="Right"><ChevronRight /></PadButton>
              <span />
              <PadButton onClick={() => tryAct("D")} label="Down"><ChevronDown /></PadButton>
              <span />
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[0.7rem] text-faint">
            <span><kbd>↑↓←→</kbd> / <kbd>WASD</kbd> move</span>
            <span><kbd>space</kbd> wait</span>
            {def.emp > 0 && <span><kbd>E</kbd> emp</span>}
            <span><kbd>F</kbd> forecast</span>
            <span><kbd>R</kbd> restart</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ icon, label, children }: { icon: ReactNode; label?: string; children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-ink2/80 px-2.5 py-1.5 text-dim">
      {icon}
      {label && <span className="hidden text-[0.62rem] uppercase tracking-[0.14em] text-faint sm:inline">{label}</span>}
      {children}
    </span>
  );
}

function PadButton({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} className="press grid h-14 w-14 place-items-center rounded-xl border border-line bg-ink2 text-paper active:bg-ink3">
      {children}
    </button>
  );
}

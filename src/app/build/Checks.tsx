"use client";

import { AlertTriangle, BrainCircuit, CheckCircle2, CircleDashed, Eye, Loader2, Lock, Play, ShieldQuestion } from "lucide-react";
import { securityRating } from "@/engine/solver";
import type { Problem } from "@/engine/validate";
import type { VaultDef } from "@/engine/types";
import type { MachineState } from "@/lib/machine";
import { Section } from "./Inspector";

export function Locks({ n, size = 13 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} of 5 locks`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Lock key={i} size={size} className={i <= n ? "text-gold drop-shadow-[0_0_4px_var(--gold)]" : "text-faint"} />
      ))}
    </span>
  );
}

function Row({ ok, pending, children }: { ok: boolean; pending?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 shrink-0">{pending ? <CircleDashed size={15} className="text-faint" /> : ok ? <CheckCircle2 size={15} className="text-mint" /> : <AlertTriangle size={15} className="text-alarm" />}</span>
      <span className={ok ? "text-paper" : "text-dim"}>{children}</span>
    </li>
  );
}

export interface ChecksProps {
  def: VaultDef;
  problems: Problem[];
  proofTurns: number | null;
  machine: MachineState;
  onTest: () => void;
  onThinkHarder: () => void;
  onWatch: (moves: string) => void;
}

export function Checks({ def, problems, proofTurns, machine, onTest, onThinkHarder, onWatch }: ChecksProps) {
  const valid = problems.length === 0;
  const fresh = machine.status !== "idle" && machine.def === def;
  const result = fresh && machine.status === "done" ? machine.result : null;
  const thinking = fresh && machine.status === "running";
  const rating = result?.status === "solved" ? securityRating(result.turns, result.explored, result.lowerBound) : null;

  return (
    <Section title="before you publish">
      <ul className="flex flex-col gap-2">
        <Row ok={valid}>{valid ? "Blueprint is sound" : `${problems.length} problem${problems.length > 1 ? "s" : ""} to fix`}</Row>
        {!valid && (
          <ul className="ml-6 flex flex-col gap-1">
            {problems.slice(0, 6).map((p, i) => (
              <li key={i} className="text-xs text-alarm">
                {p.message}
              </li>
            ))}
          </ul>
        )}
        <Row ok={proofTurns != null} pending={!valid}>
          {proofTurns != null ? `You cracked it in ${proofTurns} turns` : "Crack it yourself: you can only publish a vault you've beaten"}
        </Row>
      </ul>
      <button
        onClick={onTest}
        disabled={!valid}
        className="press mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-mint py-2 font-mono text-sm text-ink transition hover:brightness-110 disabled:opacity-30"
      >
        <Play size={14} /> {proofTurns != null ? "crack it again" : "test crack"}
      </button>

      <div className="mt-4 rounded-md border border-line bg-ink p-3">
        <div className="flex items-center gap-2">
          <BrainCircuit size={15} className="text-cyan" />
          <span className="label text-cyan">the machine</span>
        </div>
        <div className="mt-2 text-sm">
          {!valid ? (
            <p className="text-faint">Fix the blueprint and the Machine will try to break in.</p>
          ) : thinking || !fresh ? (
            <p className="flex items-center gap-2 text-dim">
              <Loader2 size={14} className="animate-spin" /> casing the joint… {machine.status === "running" && machine.explored > 0 ? `${(machine.explored / 1000).toFixed(0)}k positions` : ""}
            </p>
          ) : result?.status === "solved" && rating ? (
            <div className="flex flex-col gap-2">
              <p className="text-paper">
                Best possible heist: <span className="font-mono text-gold">{result.turns} turns</span>
              </p>
              <div className="flex items-center gap-2">
                <Locks n={rating.locks} />
                <span className="font-mono text-xs uppercase tracking-wider text-gold">{rating.label}</span>
              </div>
              <button onClick={() => onWatch(result.moves)} className="press flex items-center gap-1.5 self-start font-mono text-xs text-cyan hover:underline">
                <Eye size={13} /> watch the Machine&apos;s route
              </button>
              {proofTurns != null && proofTurns > result.turns && <p className="text-xs text-faint">Your crack took {proofTurns - result.turns} turns longer. Someone out there will find the short way.</p>}
            </div>
          ) : result?.status === "impossible" ? (
            <p className="text-alarm">Nobody can crack this, not even in theory. Players need a way in: loosen something up.</p>
          ) : result?.status === "gave-up" ? (
            <div className="flex flex-col gap-2">
              <p className="flex items-start gap-2 text-amber">
                <ShieldQuestion size={15} className="mt-0.5 shrink-0" /> Gave up after {(result.explored / 1000).toFixed(0)}k positions. Either brutally hard or impossible.
              </p>
              <button onClick={onThinkHarder} className="press self-start rounded border border-line px-2.5 py-1 font-mono text-xs text-dim hover:text-paper">
                think harder
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Check, Lock } from "lucide-react";
import { HEISTS } from "@/content/heists";
import { useSettings } from "@/stores/settings";
import { useHydrated } from "@/lib/hooks";
import { MiniBoard } from "@/components/board/MiniBoard";

export function HeistList() {
  const campaign = useSettings((s) => s.campaign);
  const hydrated = useHydrated();
  const done = hydrated ? campaign : {};
  // each heist unlocks when the previous one is cracked
  const unlocked = (n: number) => n === 1 || !!done[HEISTS[n - 2].id];

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="label text-cyan">campaign</div>
      <h1 className="display mt-3 text-4xl text-paper sm:text-6xl">Twelve heists.</h1>
      <p className="mt-4 max-w-xl text-dim">Each one teaches a trick: patrols, takedowns, cameras, lasers, keycards, EMPs. Crack them all and you&apos;ll know every way a vault can be broken, and every way to make one that can&apos;t.</p>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {HEISTS.map((h, i) => {
          const open = unlocked(h.n);
          const best = done[h.id];
          const card = (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`group relative overflow-hidden rounded-xl border bg-ink2/70 p-4 transition-colors ${open ? "border-line hover:border-cyan/60" : "border-line/50 opacity-50"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[0.65rem] tracking-[0.16em] text-faint">HEIST {String(h.n).padStart(2, "0")}</div>
                  <div className="mt-1 font-display text-lg text-paper">{h.title}</div>
                </div>
                {best ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[0.68rem] text-gold">
                    <Check size={12} /> {best.turns} turns
                  </span>
                ) : !open ? (
                  <Lock size={15} className="text-faint" />
                ) : null}
              </div>
              <div className="mt-4 flex h-36 items-center justify-center">
                <MiniBoard def={h.def} maxW={300} maxH={140} />
              </div>
            </motion.div>
          );
          return open ? (
            <Link key={h.id} href={`/heists/${h.id}`} className="press block">
              {card}
            </Link>
          ) : (
            <div key={h.id} aria-disabled title="Crack the previous heist to unlock">
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}

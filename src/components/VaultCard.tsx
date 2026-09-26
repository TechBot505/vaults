"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Skull } from "lucide-react";
import { MiniBoard } from "@/components/board/MiniBoard";
import { Locks } from "@/components/Locks";
import type { VaultCard as Card } from "@/server/vaults";

export function VaultCard({ v, i = 0, badge }: { v: Card; i?: number; badge?: React.ReactNode }) {
  const caught = v.attempts - v.cracks;
  const unbroken = v.cracks === 0 && v.attempts >= 3;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.035 }}>
      <Link
        href={`/v/${v.code}`}
        className={`group relative flex h-full flex-col overflow-hidden rounded-xl border bg-ink2/70 p-4 transition-colors hover:border-cyan/60 ${unbroken ? "border-alarm/40" : "border-line"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-display text-lg text-paper">{v.title}</div>
            <div className="truncate font-mono text-[0.68rem] text-faint">by @{v.creator.handle}</div>
          </div>
          {badge ?? <Locks n={v.rating} size={11} />}
        </div>
        <div className="my-3 flex h-36 items-center justify-center opacity-85 transition-opacity group-hover:opacity-100">
          <MiniBoard def={v.def} maxW={300} maxH={140} />
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 font-mono text-[0.7rem]">
          {v.attempts === 0 ? (
            <span className="text-mint">untouched: be the first</span>
          ) : unbroken ? (
            <span className="inline-flex items-center gap-1 text-alarm">
              <Skull size={12} /> unbroken · {caught} caught
            </span>
          ) : (
            <span className="text-dim">
              <span className="text-paper">{v.cracks}</span>/{v.attempts} cracked
            </span>
          )}
          <span className="text-faint">par {v.par}</span>
        </div>
      </Link>
    </motion.div>
  );
}

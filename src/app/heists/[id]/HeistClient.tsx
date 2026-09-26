"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, List } from "lucide-react";
import { HeistPlayer } from "@/components/board/HeistPlayer";
import { HEISTS, type Heist } from "@/content/heists";
import { useSettings } from "@/stores/settings";
import { useMemo } from "react";
import { solve } from "@/engine/solver";

export function HeistClient({ heist }: { heist: Heist }) {
  const router = useRouter();
  const complete = useSettings((s) => s.completeHeist);
  const next = HEISTS.find((h) => h.n === heist.n + 1);
  // tutorial vaults are small: the Machine's best route is instant to compute
  const par = useMemo(() => {
    const r = solve(heist.def, { maxStates: 200_000 });
    return r.status === "solved" ? r.turns : null;
  }, [heist.def]);

  return (
    <HeistPlayer
      key={heist.id}
      def={heist.def}
      title={heist.title}
      kicker={`heist ${String(heist.n).padStart(2, "0")} / ${HEISTS.length}`}
      par={par}
      intro={
        <p className="rise mx-auto max-w-2xl rounded-md border border-cyan/30 bg-cyan/5 px-4 py-2.5 text-center text-sm text-paper">
          <span className="mr-2 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-cyan">lesson</span>
          {heist.tip}
        </p>
      }
      onEnd={(s) => {
        if (s.status === "cracked") complete(heist.id, s.t);
      }}
      crackedActions={() => (
        <>
          {next ? (
            <button
              autoFocus
              onClick={() => router.push(`/heists/${next.id}`)}
              className="press inline-flex items-center gap-2 rounded-md bg-gold px-5 py-2.5 font-mono text-sm text-ink hover:brightness-110"
            >
              next heist <ArrowRight size={15} />
            </button>
          ) : (
            <Link href="/build" autoFocus className="press inline-flex items-center gap-2 rounded-md bg-gold px-5 py-2.5 font-mono text-sm text-ink">
              now build your own <ArrowRight size={15} />
            </Link>
          )}
          <Link href="/heists" className="press inline-flex items-center gap-2 rounded-md border border-line px-4 py-2.5 font-mono text-sm text-dim hover:text-paper">
            <List size={15} /> all heists
          </Link>
        </>
      )}
    />
  );
}

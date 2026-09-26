"use client";

import Link from "next/link";
import { Hammer, Share2 } from "lucide-react";
import { HeistPlayer } from "@/components/board/HeistPlayer";
import type { VaultDef } from "@/engine/types";
import { toast } from "@/components/Toaster";

export function PlayClient({ def, title, par, code }: { def: VaultDef; title: string; par: number | null; code: string }) {
  const share = async (text: string) => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast({ title: "Copied", body: "Paste it anywhere.", tone: "good" });
      }
    } catch {
      /* user closed the share sheet */
    }
  };
  return (
    <HeistPlayer
      def={def}
      title={title}
      kicker="a vault someone dared you to crack"
      par={par}
      crackedActions={(s) => (
        <>
          <button autoFocus onClick={() => share(`I cracked "${title}" in ${s.t} turns${par ? ` (par ${par})` : ""}. Your turn.`)} className="press inline-flex items-center gap-2 rounded-md bg-gold px-5 py-2.5 font-mono text-sm text-ink hover:brightness-110">
            <Share2 size={15} /> brag
          </button>
          <Link href={`/build?v=${code}`} className="press inline-flex items-center gap-2 rounded-md border border-line px-4 py-2.5 font-mono text-sm text-dim hover:text-paper">
            <Hammer size={15} /> remix it
          </Link>
        </>
      )}
    />
  );
}

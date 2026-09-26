import type { Metadata } from "next";
import Link from "next/link";
import { Hammer, KeySquare } from "lucide-react";
import { databaseEnabled } from "@/server/env";
import { builderLeaderboard, thiefLeaderboard } from "@/server/vaults";

export const metadata: Metadata = { title: "Leaderboard", description: "The best thieves and the most dangerous builders." };

export default async function LeaderboardPage() {
  const [thieves, builders] = await Promise.all([thiefLeaderboard(50), builderLeaderboard(50)]);
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="label text-cyan">leaderboard</div>
      <h1 className="display mt-3 text-4xl text-paper sm:text-6xl">Most wanted.</h1>
      {!databaseEnabled && <p className="mt-6 text-dim">Leaderboards switch on once this site has public vaults.</p>}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Board
          title="thieves"
          icon={<KeySquare size={14} />}
          blurb="Points for every vault cracked: 10 per lock, +25 for first blood, +10 for matching par."
          rows={thieves.map((t) => ({ rank: t.rank, handle: t.user.handle, main: `${t.points}`, unit: "pts", sub: `${t.cracks} cracked` }))}
          empty="No cracks on record yet."
        />
        <Board
          title="builders"
          icon={<Hammer size={14} />}
          blurb="Ranked by how many thieves their vaults have caught."
          rows={builders.map((b) => ({ rank: b.rank, handle: b.user.handle, main: `${b.captures}`, unit: "caught", sub: `${b.vaults} vault${b.vaults === 1 ? "" : "s"}` }))}
          empty="No vaults published yet."
        />
      </div>
    </div>
  );
}

function Board({ title, icon, blurb, rows, empty }: { title: string; icon: React.ReactNode; blurb: string; rows: { rank: number; handle: string; main: string; unit: string; sub: string }[]; empty: string }) {
  return (
    <section className="rounded-xl border border-line bg-ink2/60 p-4">
      <h2 className="label flex items-center gap-2 text-gold">
        {icon} {title}
      </h2>
      <p className="mt-1 text-xs text-faint">{blurb}</p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-dim">{empty}</p>
      ) : (
        <ol className="mt-4 flex flex-col">
          {rows.map((r) => (
            <li key={r.handle} className="flex items-center gap-3 border-t border-line/60 py-2 first:border-t-0">
              <span className={`w-7 text-right font-display ${r.rank <= 3 ? "text-gold" : "text-faint"}`}>{r.rank}</span>
              <Link href={`/u/${r.handle}`} className="min-w-0 flex-1 truncate text-paper hover:underline">
                @{r.handle}
              </Link>
              <span className="hidden font-mono text-xs text-faint sm:inline">{r.sub}</span>
              <span className="w-24 text-right font-mono text-sm text-paper">
                {r.main} <span className="text-faint">{r.unit}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

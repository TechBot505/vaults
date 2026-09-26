import type { Metadata } from "next";
import Link from "next/link";
import { Hammer } from "lucide-react";
import { databaseEnabled } from "@/server/env";
import { listVaults, type Sort } from "@/server/vaults";
import { VaultCard } from "@/components/VaultCard";

export const metadata: Metadata = { title: "Vaults", description: "Vaults built by players. Some have never been cracked." };

const TABS: { id: Sort; label: string; blurb: string }[] = [
  { id: "trending", label: "trending", blurb: "Where the thieves are right now." },
  { id: "unbroken", label: "unbroken", blurb: "Three runs or more, and nobody has ever gotten the loot out." },
  { id: "hardest", label: "hardest", blurb: "Lowest crack rate, five runs or more." },
  { id: "new", label: "new", blurb: "Fresh off the drawing board." },
];

export default async function VaultsPage(props: PageProps<"/vaults">) {
  const sp = await props.searchParams;
  const sort = (TABS.find((t) => t.id === sp.sort)?.id ?? "trending") as Sort;
  const vaults = await listVaults(sort, 36);
  const tab = TABS.find((t) => t.id === sort)!;
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="label text-cyan">the vault list</div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-4xl text-paper sm:text-6xl">Break in.</h1>
        <Link href="/build" className="press inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 font-mono text-sm text-ink hover:brightness-110">
          <Hammer size={15} /> build one
        </Link>
      </div>
      <p className="mt-4 max-w-xl text-dim">Every vault here was cracked by its builder before it went up. So there&apos;s always a way in. Usually.</p>

      <nav aria-label="Sort" className="mt-8 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "trending" ? "/vaults" : `/vaults?sort=${t.id}`}
            aria-current={t.id === sort ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 font-mono text-sm ${t.id === sort ? "border-cyan text-paper" : "border-transparent text-dim hover:text-paper"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-sm text-faint">{tab.blurb}</p>

      {!databaseEnabled ? (
        <div className="mt-10 rounded-xl border border-line bg-ink2/60 p-6 text-dim">
          <p className="text-paper">The public vault list isn&apos;t switched on for this site yet.</p>
          <p className="mt-2 text-sm">You can still build a vault and send it to friends as a link, or play the campaign.</p>
        </div>
      ) : vaults.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-line p-8 text-center">
          <p className="text-paper">{sort === "unbroken" ? "Every vault has fallen. For now." : "No vaults here yet."}</p>
          <Link href="/build" className="mt-3 inline-block font-mono text-sm text-cyan hover:underline">
            be the first to build one →
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vaults.map((v, i) => (
            <VaultCard key={v.code} v={v} i={i} />
          ))}
        </div>
      )}
    </div>
  );
}

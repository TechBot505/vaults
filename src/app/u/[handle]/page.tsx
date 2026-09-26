import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Droplet } from "lucide-react";
import { getProfile } from "@/server/vaults";
import { VaultCard } from "@/components/VaultCard";

export async function generateMetadata(props: PageProps<"/u/[handle]">): Promise<Metadata> {
  const { handle } = await props.params;
  return { title: `@${handle}` };
}

export default async function ProfilePage(props: PageProps<"/u/[handle]">) {
  const { handle } = await props.params;
  const p = await getProfile(decodeURIComponent(handle));
  if (!p) notFound();
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="flex items-center gap-4">
        {p.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.user.avatarUrl} alt="" className="h-16 w-16 rounded-full border border-line object-cover" />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-full border border-line font-display text-xl text-cyan">{p.user.handle[0]?.toUpperCase()}</div>
        )}
        <div>
          <h1 className="display text-3xl text-paper sm:text-4xl">@{p.user.handle}</h1>
          {p.user.displayName && <div className="text-dim">{p.user.displayName}</div>}
        </div>
      </div>
      <dl className="mt-6 grid max-w-xl grid-cols-3 gap-3">
        {[
          ["points", p.points],
          ["cracked", p.cracks.length],
          ["thieves caught", p.captures],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-line bg-ink2/60 px-3 py-3 text-center">
            <dt className="font-display text-2xl text-paper">{v}</dt>
            <dd className="font-mono text-[0.62rem] uppercase tracking-wider text-faint">{l}</dd>
          </div>
        ))}
      </dl>

      <h2 className="label mt-10 text-cyan">vaults built · {p.vaults.length}</h2>
      {p.vaults.length === 0 ? (
        <p className="mt-3 text-sm text-dim">Hasn&apos;t built one yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {p.vaults.map((v, i) => (
            <VaultCard key={v.code} v={v} i={i} />
          ))}
        </div>
      )}

      <h2 className="label mt-10 text-gold">vaults cracked · {p.cracks.length}</h2>
      {p.cracks.length === 0 ? (
        <p className="mt-3 text-sm text-dim">No cracks yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {p.cracks.map((c, i) => (
            <VaultCard
              key={c.vault.code}
              v={c.vault}
              i={i}
              badge={
                <span className="flex shrink-0 flex-col items-end gap-1 font-mono text-[0.68rem]">
                  <span className="text-gold">{c.turns} turns</span>
                  {c.first && (
                    <span className="inline-flex items-center gap-1 text-alarm">
                      <Droplet size={10} /> first
                    </span>
                  )}
                </span>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

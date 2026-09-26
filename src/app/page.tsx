import Link from "next/link";
import { ArrowRight, BrainCircuit, Eye, Hammer, Share2, Skull, Timer, Zap } from "lucide-react";
import { getHeist } from "@/content/heists";
import { solve } from "@/engine/solver";
import { databaseEnabled } from "@/server/env";
import { listVaults, siteStats } from "@/server/vaults";
import { DemoLoop } from "@/components/home/DemoLoop";
import { VaultCard } from "@/components/VaultCard";

// solved once per server instance, not per request
const demo = getHeist("gauntlet")!;
const machine = solve(demo.def);
const moves = machine.status === "solved" ? machine.moves : "";

export default async function Home() {
  const [unbroken, stats] = databaseEnabled ? await Promise.all([listVaults("unbroken", 3), siteStats()]) : [[], null];
  const featured = unbroken.length ? unbroken : databaseEnabled ? await listVaults("trending", 3) : [];

  return (
    <div className="flex flex-col">
      {/* hero */}
      <section className="mx-auto grid w-full max-w-[1300px] grid-cols-1 items-center gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-14">
        <div className="rise">
          <div className="label text-cyan">a turn-based heist game</div>
          <h1 className="display glow-text mt-4 text-5xl leading-[0.95] text-paper sm:text-7xl">
            Build a vault
            <br />
            <span className="text-gold">nobody</span> can crack.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-dim">
            Guards, cameras and lasers all move on a fixed beat. Read the pattern, slip through the gaps, walk out with the loot. Then draw your own vault and dare the internet to break in.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/heists" className="press inline-flex items-center gap-2 rounded-md bg-gold px-6 py-3 font-mono text-sm text-ink shadow-[0_0_30px_-8px_var(--gold)] hover:brightness-110">
              crack your first vault <ArrowRight size={16} />
            </Link>
            <Link href="/build" className="press inline-flex items-center gap-2 rounded-md border border-line px-5 py-3 font-mono text-sm text-paper hover:border-cyan">
              <Hammer size={15} /> build one
            </Link>
          </div>
          {stats && stats.vaults > 0 && (
            <p className="mt-6 font-mono text-xs text-faint">
              <span className="text-paper">{stats.vaults.toLocaleString()}</span> vaults built · <span className="text-alarm">{stats.caught.toLocaleString()}</span> thieves caught ·{" "}
              <span className="text-gold">{stats.cracks.toLocaleString()}</span> cracks
            </p>
          )}
        </div>
        <div className="rise relative min-w-0 rounded-2xl border border-line bg-ink2/60 p-4 shadow-[0_40px_120px_-40px_var(--cyan)] sm:p-6" style={{ animationDelay: "120ms" }}>
          <div className="mb-3 flex items-center gap-2">
            <BrainCircuit size={14} className="text-cyan" />
            <span className="label text-cyan">the machine, cracking “{demo.title}”</span>
          </div>
          {moves && <DemoLoop def={demo.def} moves={moves} label={`${moves.length}-turn route, the shortest one there is`} />}
        </div>
      </section>

      {/* how */}
      <section className="mx-auto w-full max-w-[1300px] px-4 py-14 sm:px-6">
        <div className="label text-cyan">how a heist works</div>
        <h2 className="display mt-3 text-3xl text-paper sm:text-5xl">Everything repeats. Nothing is random.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: <Timer size={18} />, title: "One move, one beat", body: "You move a tile, the building ticks once. Patrols, camera sweeps and laser timings loop forever, so every vault is a pattern you can learn." },
            { icon: <Eye size={18} />, title: "Stay out of sight", body: "Vision cones widen with distance and stop at walls and doors. Step into one and it's over. Press F to see where everyone looks next turn." },
            { icon: <Zap size={18} />, title: "Cheat a little", body: "Knock out a guard from behind (then hope nobody finds the body), fire an EMP to kill cameras and lasers, grab keycards to open doors." },
          ].map((c) => (
            <div key={c.title} className="rounded-xl border border-line bg-ink2/60 p-5">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-cyan/10 text-cyan">{c.icon}</div>
              <h3 className="mt-4 font-display text-lg text-paper">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-dim">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* build loop */}
      <section className="mx-auto w-full max-w-[1300px] px-4 py-14 sm:px-6">
        <div className="grid gap-10 rounded-2xl border border-line bg-ink2/50 p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <div className="label text-gold">then turn the tables</div>
            <h2 className="display mt-3 text-3xl text-paper sm:text-5xl">Build. Prove it. Dare them.</h2>
            <p className="mt-4 text-dim">Draw walls, post guards, mount cameras, stretch tripwires. The Machine searches every possible heist while you build and tells you how hard your vault really is.</p>
            <Link href="/build" className="press mt-6 inline-flex items-center gap-2 rounded-md bg-paper px-5 py-2.5 font-mono text-sm text-ink hover:bg-cyan">
              open the builder <ArrowRight size={15} />
            </Link>
          </div>
          <ol className="flex flex-col gap-4">
            {[
              { icon: <Hammer size={16} />, title: "Design the trap", body: "Twelve guards, twelve cameras, twelve lasers, keycard doors, a turn limit. Scrub the timeline to watch your patrols move." },
              { icon: <BrainCircuit size={16} />, title: "Face the Machine", body: "It finds the shortest possible crack and rates your vault from one lock to five. If there's no way in at all, it tells you." },
              { icon: <Skull size={16} />, title: "Crack it yourself", body: "You can only publish a vault you've beaten. So every vault on this site is fair. Just not easy." },
              { icon: <Share2 size={16} />, title: "Collect the captures", body: "Share the link. Every thief your vault catches counts toward your rank as a builder." },
            ].map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold/50 font-mono text-sm text-gold">{i + 1}</span>
                <div>
                  <h3 className="flex items-center gap-2 font-display text-paper">{s.title}</h3>
                  <p className="mt-1 text-sm text-dim">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto w-full max-w-[1300px] px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="label text-alarm">{unbroken.length ? "never cracked" : "trending"}</div>
              <h2 className="display mt-3 text-3xl text-paper sm:text-5xl">{unbroken.length ? "Nobody has gotten out of these." : "Where the thieves are."}</h2>
            </div>
            <Link href={unbroken.length ? "/vaults?sort=unbroken" : "/vaults"} className="font-mono text-sm text-cyan hover:underline">
              all vaults →
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((v, i) => (
              <VaultCard key={v.code} v={v} i={i} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto w-full max-w-[1300px] px-4 pb-20 pt-10 text-center sm:px-6">
        <h2 className="display text-3xl text-paper sm:text-5xl">Twelve heists to learn every trick.</h2>
        <p className="mx-auto mt-4 max-w-md text-dim">Takes about half an hour. After that, no vault on this site is safe from you.</p>
        <Link href="/heists" className="press mt-8 inline-flex items-center gap-2 rounded-md bg-gold px-6 py-3 font-mono text-sm text-ink hover:brightness-110">
          start the campaign <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  );
}

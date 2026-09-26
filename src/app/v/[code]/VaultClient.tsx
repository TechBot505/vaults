"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Crown, Droplet, Eye, Hammer, Loader2, Lock, LogIn, Share2, Skull, Trash2, Trophy } from "lucide-react";
import { HeistPlayer } from "@/components/board/HeistPlayer";
import { ReplayView } from "@/components/board/ReplayView";
import { Board } from "@/components/board/Board";
import { sceneFor } from "@/components/board/scene";
import { useTileSize } from "@/components/board/useTileSize";
import { Level } from "@/engine/geometry";
import type { GameState, VaultDef } from "@/engine/types";
import { toast } from "@/components/Toaster";
import { useClientAuth } from "@/lib/auth-client";
import { playerId, shareOrCopy } from "@/lib/player";
import { describeVault } from "@/lib/copy";
import { Locks } from "@/components/Locks";
import type { AttemptResult, BoardEntry, PublicVault } from "@/server/vaults";

type Submit = { status: "idle" } | { status: "sending" } | { status: "done"; r: AttemptResult } | { status: "error"; message: string };

export function VaultClient({ vault, board, viewer, access }: { vault: PublicVault; board: BoardEntry[]; viewer: { handle: string } | null; access: { creator: boolean; cracked: boolean } }) {
  const router = useRouter();
  const auth = useClientAuth();
  const [submit, setSubmit] = useState<Submit>({ status: "idle" });
  const [stats, setStats] = useState({ attempts: vault.attempts, cracks: vault.cracks, bestTurns: vault.bestTurns });
  const [unlocked, setUnlocked] = useState(access.cracked);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/v/${vault.code}`;

  const report = async (s: GameState, ms: number) => {
    setSubmit({ status: "sending" });
    try {
      const res = await fetch(`/api/vaults/${vault.code}/attempts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ moves: s.moves, player: playerId(), ms }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "couldn't file the report");
      const r = body as AttemptResult;
      setSubmit({ status: "done", r });
      setStats({ attempts: r.vault.attempts, cracks: r.vault.cracks, bestTurns: r.vault.bestTurns });
      if (r.outcome === "cracked" && viewer) {
        setUnlocked(true);
        router.refresh();
      }
    } catch (e) {
      setSubmit({ status: "error", message: e instanceof Error ? e.message : "network error" });
    }
  };

  const dare = async (text: string) => {
    const r = await shareOrCopy({ title: vault.title, text, url });
    if (r === "copied") toast({ title: "Copied the dare", body: "Paste it anywhere.", tone: "good" });
  };

  const rate = stats.attempts ? Math.round((stats.cracks / stats.attempts) * 100) : null;

  const signInNudge = !viewer && auth.enabled && (
    <button onClick={auth.openSignIn} className="press inline-flex items-center gap-2 rounded-md border border-cyan/50 px-4 py-2.5 font-mono text-sm text-cyan hover:bg-cyan/10">
      <LogIn size={15} /> sign in to hit the leaderboard
    </button>
  );

  return (
    <div className="flex flex-col">
      <HeistPlayer
        def={vault.def}
        title={vault.title}
        kicker={`vault ${vault.code} · built by @${vault.creator.handle}`}
        par={vault.par}
        intro={
          <div className="rise mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-1 rounded-md border border-line bg-ink2/70 px-4 py-2 text-center font-mono text-xs text-dim">
            {access.creator ? (
              <span className="text-amber">your vault · your own runs don&apos;t count</span>
            ) : (
              <>
                <span>
                  <Locks n={vault.rating} size={11} />
                </span>
                <span>{stats.attempts === 0 ? "nobody has tried it yet: be the first" : stats.cracks === 0 ? `${stats.attempts} tries · never cracked` : `${stats.cracks} of ${stats.attempts} runs cracked it`}</span>
                <span>par {vault.par}</span>
              </>
            )}
          </div>
        }
        onEnd={(s, _attempt, ms) => void report(s, ms)}
        crackedActions={(s) => (
          <>
            <ReportLine submit={submit} creator={access.creator} />
            <button
              autoFocus
              onClick={() => dare(`I cracked "${vault.title}" in ${s.t} turns on VAULTS${stats.attempts > 1 ? ` (only ${stats.cracks} of ${stats.attempts} runs have)` : ""}. Your move.`)}
              className="press inline-flex items-center gap-2 rounded-md bg-gold px-5 py-2.5 font-mono text-sm text-ink hover:brightness-110"
            >
              <Share2 size={15} /> brag
            </button>
            {signInNudge}
            {viewer && (
              <Link href={`/build?remix=${vault.code}`} className="press inline-flex items-center gap-2 rounded-md border border-line px-4 py-2.5 font-mono text-sm text-dim hover:text-paper">
                <Hammer size={15} /> remix
              </Link>
            )}
          </>
        )}
        caughtActions={() => (
          <>
            <ReportLine submit={submit} creator={access.creator} />
            <button onClick={() => dare(`"${vault.title}" on VAULTS: ${stats.attempts} tries, ${stats.cracks} cracks. Think you can get the loot out?`)} className="press inline-flex items-center gap-2 rounded-md border border-line px-4 py-2.5 font-mono text-sm text-dim hover:text-paper">
              <Share2 size={15} /> dare a friend
            </button>
          </>
        )}
      />

      <div className="mx-auto grid w-full max-w-[1200px] gap-4 px-4 pb-10 pt-4 sm:px-6 md:grid-cols-[1fr_1.2fr]">
        <section className="rounded-xl border border-line bg-ink2/60 p-4">
          <h2 className="label text-cyan">the file</h2>
          <p className="mt-2 text-sm text-dim">{describeVault(vault.def)}</p>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Stat label="runs" value={stats.attempts} />
            <Stat label="cracks" value={stats.cracks} tone={stats.cracks === 0 && stats.attempts > 0 ? "alarm" : undefined} />
            <Stat label="crack rate" value={rate == null ? "—" : `${rate}%`} />
            <Stat label="par" value={vault.par} tone="gold" />
            <Stat label="record" value={stats.bestTurns ?? "—"} />
            <div className="flex flex-col items-center justify-center gap-1 rounded-md bg-ink px-2 py-2">
              <Locks n={vault.rating} size={11} />
              <dd className="font-mono text-[0.62rem] uppercase tracking-wider text-faint">security</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
            <span>
              built by{" "}
              <Link href={`/u/${vault.creator.handle}`} className="text-dim hover:text-paper">
                @{vault.creator.handle}
              </Link>{" "}
              · {new Date(vault.createdAt).toLocaleDateString()}
            </span>
            {vault.machineGaveUp && <span className="text-amber">the Machine never found a way in</span>}
          </div>
          {access.creator && <CreatorTools code={vault.code} />}
        </section>

        <section className="rounded-xl border border-line bg-ink2/60 p-4">
          <h2 className="label flex items-center gap-2 text-gold">
            <Trophy size={13} /> fastest cracks
          </h2>
          {board.length === 0 ? (
            <p className="mt-3 text-sm text-dim">{stats.cracks > 0 ? "Cracked, but only by people who weren't signed in." : "Nobody's name is on this one yet."}</p>
          ) : (
            <ol className="mt-3 flex flex-col gap-1">
              {board.map((e) => (
                <li key={e.user.handle} className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${viewer?.handle === e.user.handle ? "bg-cyan/10" : ""}`}>
                  <span className={`w-6 text-right font-mono text-sm ${e.rank === 1 ? "text-gold" : "text-faint"}`}>{e.rank === 1 ? <Crown size={14} className="ml-auto" /> : e.rank}</span>
                  <Link href={`/u/${e.user.handle}`} className="min-w-0 flex-1 truncate text-sm text-paper hover:underline">
                    @{e.user.handle}
                  </Link>
                  {e.first && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-alarm/15 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-alarm" title="First to crack it">
                      <Droplet size={10} /> first blood
                    </span>
                  )}
                  <span className="font-mono text-sm text-gold">{e.turns}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <Intel vault={vault} unlocked={unlocked} viewer={viewer} />
      </div>
    </div>
  );
}

function ReportLine({ submit, creator }: { submit: Submit; creator: boolean }) {
  if (submit.status === "sending")
    return (
      <span className="flex w-full items-center gap-2 font-mono text-xs text-dim">
        <Loader2 size={13} className="animate-spin" /> filing the report…
      </span>
    );
  if (submit.status === "error") return <span className="w-full font-mono text-xs text-alarm">{submit.message}</span>;
  if (submit.status !== "done") return null;
  const r = submit.r;
  if (creator) return <span className="w-full font-mono text-xs text-faint">builder&apos;s run: not counted</span>;
  if (r.outcome === "caught") {
    const caught = r.vault.attempts - r.vault.cracks;
    return <span className="w-full font-mono text-xs text-dim">you&apos;re one of {caught} thieves this vault has caught</span>;
  }
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex w-full flex-wrap items-center gap-2 font-mono text-xs">
      {r.firstBlood && (
        <span className="stamp inline-flex items-center gap-1 rounded-md border-2 border-alarm px-2 py-0.5 text-alarm">
          <Droplet size={12} /> FIRST BLOOD
        </span>
      )}
      {r.rank != null && <span className="text-paper">#{r.rank} on the board</span>}
      {r.points > 0 && <span className="text-gold">+{r.points} pts</span>}
      {r.personalBest && r.rank != null && !r.firstBlood && <span className="text-mint">personal best</span>}
    </motion.div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "gold" | "alarm" }) {
  return (
    <div className="rounded-md bg-ink px-2 py-2">
      <dt className={`font-display text-xl ${tone === "gold" ? "text-gold" : tone === "alarm" ? "text-alarm" : "text-paper"}`}>{value}</dt>
      <dd className="font-mono text-[0.62rem] uppercase tracking-wider text-faint">{label}</dd>
    </div>
  );
}

function CreatorTools({ code }: { code: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
      <Link href={`/build?remix=${code}`} className="press inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 font-mono text-xs text-dim hover:text-paper">
        <Hammer size={13} /> make a new version
      </Link>
      <button
        onClick={async () => {
          if (!confirm) return setConfirm(true);
          const res = await fetch(`/api/vaults/${code}`, { method: "DELETE" });
          if (res.ok) {
            toast({ title: "Vault taken down" });
            router.push("/vaults");
          } else toast({ title: "Couldn't take it down", tone: "bad" });
        }}
        className="press inline-flex items-center gap-1.5 rounded-md border border-alarm/40 px-3 py-1.5 font-mono text-xs text-alarm hover:bg-alarm/10"
      >
        <Trash2 size={13} /> {confirm ? "really take it down?" : "take it down"}
      </button>
    </div>
  );
}

interface IntelData {
  runs: { turns: number; moves: string; user: { handle: string; displayName: string | null } }[];
  deaths: { x: number; y: number; n: number }[];
}

/** Spoilers: best runs and where everyone gets caught. Unlocked by cracking it. */
function Intel({ vault, unlocked, viewer }: { vault: PublicVault; unlocked: boolean; viewer: { handle: string } | null }) {
  const [data, setData] = useState<IntelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState<number | null>(null);

  useEffect(() => {
    if (!unlocked) return;
    let live = true;
    fetch(`/api/vaults/${vault.code}/replays`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? "couldn't load intel");
        if (live) setData(body as IntelData);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [unlocked, vault.code]);

  return (
    <section className="rounded-xl border border-line bg-ink2/60 p-4 md:col-span-2">
      <h2 className="label flex items-center gap-2 text-alarm">
        <Skull size={13} /> intel
      </h2>
      {!unlocked ? (
        <div className="mt-3 flex items-center gap-3 text-sm text-dim">
          <Lock size={16} className="shrink-0 text-faint" />
          <p>{viewer ? "Crack it to unlock the best runs and the map of where everyone gets caught." : "Sign in and crack it to unlock the best runs and the map of where everyone gets caught."}</p>
        </div>
      ) : error ? (
        <p className="mt-3 text-sm text-alarm">{error}</p>
      ) : !data ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-dim">
          <Loader2 size={14} className="animate-spin" /> decrypting…
        </p>
      ) : (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 font-mono text-xs text-dim">where thieves get caught ({data.deaths.reduce((s, d) => s + d.n, 0)})</h3>
            <DeathMap def={vault.def} deaths={data.deaths} />
          </div>
          <div>
            <h3 className="mb-2 font-mono text-xs text-dim">best runs</h3>
            {watching != null && data.runs[watching] ? (
              <div className="flex flex-col gap-2">
                <button onClick={() => setWatching(null)} className="press self-start font-mono text-xs text-cyan hover:underline">
                  ← all runs
                </button>
                <ReplayView def={vault.def} moves={data.runs[watching].moves} label={`@${data.runs[watching].user.handle}'s crack`} height="42vh" maxTile={36} />
              </div>
            ) : (
              <ol className="flex flex-col gap-1">
                {data.runs.map((r, i) => (
                  <li key={i}>
                    <button onClick={() => setWatching(i)} className="press flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-ink3">
                      <Eye size={14} className="text-cyan" />
                      <span className="flex-1 truncate text-sm text-paper">@{r.user.handle}</span>
                      <span className="font-mono text-sm text-gold">{r.turns} turns</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function DeathMap({ def, deaths }: { def: VaultDef; deaths: { x: number; y: number; n: number }[] }) {
  const level = useMemo(() => new Level(def), [def]);
  const scene = useMemo(() => sceneFor(level, null, 0), [level]);
  const { ref, tile } = useTileSize(def.w, def.h, { max: 36 });
  const max = Math.max(1, ...deaths.map((d) => d.n));
  const overlay = (
    <g pointerEvents="none">
      {deaths.map((d) => (
        <g key={`${d.x},${d.y}`}>
          <rect x={d.x + 0.04} y={d.y + 0.04} width="0.92" height="0.92" rx="0.1" fill="var(--alarm)" opacity={0.25 + 0.65 * (d.n / max)} filter="url(#glow)" />
          <text x={d.x + 0.5} y={d.y + 0.62} fontSize="0.32" textAnchor="middle" fill="var(--paper)" fontFamily="var(--font-mono)">
            {d.n}
          </text>
        </g>
      ))}
    </g>
  );
  return (
    <div ref={ref} className="flex h-[42vh] w-full items-center justify-center">
      <Board level={level} scene={scene} tile={tile} hideThief overlay={overlay} stepMs={0} ariaLabel="Where thieves get caught" />
    </div>
  );
}

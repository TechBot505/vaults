import "server-only";
import { connection } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { Level } from "@/engine/geometry";
import { run } from "@/engine/game";
import { securityRating, solve } from "@/engine/solver";
import { validateVault, LIMITS } from "@/engine/validate";
import type { VaultDef } from "@/engine/types";
import { hashVault } from "@/editor/doc";
import { db, type Db } from "./db";
import { HttpError } from "./http";
import type { AuthedUser } from "./auth";

/**
 * Everything about public vaults. The server never trusts a client's claim
 * about a run: it replays the move string through the same engine.
 */

const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const MAX_MOVES = LIMITS.maxTurns * 4;

function newCode(): string {
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return s;
}

function need(): Db {
  const prisma = db();
  if (!prisma) throw new HttpError(503, "public vaults aren't set up on this server");
  return prisma;
}

export const creatorSelect = { handle: true, displayName: true, avatarUrl: true } as const;

export interface PublicVault {
  code: string;
  title: string;
  def: VaultDef;
  par: number;
  rating: number;
  machineGaveUp: boolean;
  attempts: number;
  cracks: number;
  bestTurns: number | null;
  createdAt: string;
  creator: { handle: string; displayName: string | null; avatarUrl: string | null };
}

type VaultRow = Prisma.VaultGetPayload<{ include: { creator: { select: typeof creatorSelect } } }>;

function toPublic(v: VaultRow): PublicVault {
  return {
    code: v.code,
    title: v.title,
    def: v.def as unknown as VaultDef,
    par: v.par,
    rating: v.rating,
    machineGaveUp: v.machineGaveUp,
    attempts: v.attempts,
    cracks: v.cracks,
    bestTurns: v.bestTurns,
    createdAt: v.createdAt.toISOString(),
    creator: v.creator,
  };
}

// ── publish ────────────────────────────────────────────────────────────────

export async function publishVault(user: AuthedUser, input: { title: string; def: unknown; proof: string }): Promise<{ code: string }> {
  const prisma = need();
  const checked = validateVault(input.def);
  if (!checked.ok) throw new HttpError(400, checked.problems[0]?.message ?? "invalid vault");
  const def = checked.def;
  const level = new Level(def);
  const proof = run(level, input.proof);
  if (proof.status !== "cracked" || proof.invalidAt !== null) throw new HttpError(400, "your proof run doesn't crack this vault: test-crack it again");

  const hash = hashVault(def);
  const dup = await prisma.vault.findUnique({ where: { hash }, select: { code: true } });
  if (dup) throw new HttpError(409, `this exact vault is already published: /v/${dup.code}`);

  const today = await prisma.vault.count({ where: { creatorId: user.id, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
  if (today >= 20) throw new HttpError(429, "twenty vaults a day is the limit");

  // the Machine sets par and the security rating
  const r = solve(def, { maxStates: 250_000 });
  let par = input.proof.length;
  let rating = 5;
  let machineGaveUp = false;
  if (r.status === "solved") {
    par = Math.min(par, r.turns);
    rating = securityRating(r.turns, r.explored, r.lowerBound).locks;
  } else {
    machineGaveUp = true;
  }

  const title = input.title.trim().replace(/\s+/g, " ").slice(0, 60) || "Untitled vault";
  for (let i = 0; i < 6; i++) {
    try {
      const v = await prisma.vault.create({
        data: { code: newCode(), title, def: def as unknown as Prisma.InputJsonValue, hash, creatorId: user.id, proof: input.proof, par, rating, machineGaveUp },
        select: { code: true },
      });
      return v;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = String((e.meta as { target?: unknown } | undefined)?.target ?? "");
        if (target.includes("hash")) throw new HttpError(409, "this exact vault was just published");
        continue; // code collision: roll again
      }
      throw e;
    }
  }
  throw new HttpError(500, "couldn't allocate a vault code");
}

// ── attempts ───────────────────────────────────────────────────────────────

export interface AttemptResult {
  outcome: "cracked" | "caught";
  turns: number;
  counted: boolean;
  firstBlood: boolean;
  personalBest: boolean;
  /** leaderboard position among signed-in crackers (1-based) */
  rank: number | null;
  points: number;
  vault: { attempts: number; cracks: number; bestTurns: number | null; par: number };
}

export async function recordAttempt(code: string, user: AuthedUser | null, input: { moves: string; player: string; ms: number }): Promise<AttemptResult> {
  const prisma = need();
  const vault = await prisma.vault.findUnique({ where: { code } });
  if (!vault || vault.hidden) throw new HttpError(404, "vault not found");
  const level = new Level(vault.def as unknown as VaultDef);
  const r = run(level, input.moves);
  if (r.invalidAt !== null) throw new HttpError(400, "that run contains an impossible move");
  if (r.status === "playing") throw new HttpError(400, "that run isn't over");
  const outcome = r.status;
  const turns = r.state.t;
  // nobody plays faster than ~25 turns a second; bots do
  if (outcome === "cracked" && input.ms < turns * 40) throw new HttpError(400, "that was faster than humanly possible");

  const isCreator = user?.id === vault.creatorId;
  const counted = !isCreator;
  const pos = r.state.pos;

  return prisma.$transaction(async (tx) => {
    await tx.attempt.create({
      data: {
        vaultId: vault.id,
        userId: user?.id ?? null,
        player: input.player,
        outcome,
        turns,
        moves: input.moves,
        caughtBy: r.state.caught?.kind ?? null,
        x: pos.x,
        y: pos.y,
      },
    });

    let firstBlood = false;
    let personalBest = false;
    let points = 0;
    let rank: number | null = null;
    if (counted) {
      if (outcome === "cracked" && !vault.firstCrackAt) {
        const claimed = await tx.vault.updateMany({ where: { id: vault.id, firstCrackAt: null }, data: { firstCrackAt: new Date() } });
        firstBlood = claimed.count === 1;
      }
      await tx.vault.update({
        where: { id: vault.id },
        data: {
          attempts: { increment: 1 },
          lastPlayedAt: new Date(),
          ...(outcome === "cracked" ? { cracks: { increment: 1 }, ...(vault.bestTurns == null || turns < vault.bestTurns ? { bestTurns: turns } : {}) } : {}),
        },
      });
      if (outcome === "cracked" && user) {
        const prev = await tx.crack.findUnique({ where: { vaultId_userId: { vaultId: vault.id, userId: user.id } } });
        if (!prev) {
          points = vault.rating * 10 + (firstBlood ? 25 : 0) + (turns <= vault.par ? 10 : 0);
          await tx.crack.create({ data: { vaultId: vault.id, userId: user.id, turns, moves: input.moves, points, first: firstBlood } });
          personalBest = true;
        } else if (turns < prev.turns) {
          // matching par later still earns the par bonus once
          const parBonus = turns <= vault.par && prev.turns > vault.par ? 10 : 0;
          points = parBonus;
          await tx.crack.update({ where: { id: prev.id }, data: { turns, moves: input.moves, points: prev.points + parBonus } });
          personalBest = true;
        }
        const best = personalBest ? turns : prev!.turns;
        rank = (await tx.crack.count({ where: { vaultId: vault.id, turns: { lt: best } } })) + 1;
      }
    }
    const fresh = await tx.vault.findUniqueOrThrow({ where: { id: vault.id }, select: { attempts: true, cracks: true, bestTurns: true, par: true } });
    return { outcome, turns, counted, firstBlood, personalBest, rank, points, vault: fresh };
  });
}

// ── reads ──────────────────────────────────────────────────────────────────

export async function getVault(code: string): Promise<PublicVault | null> {
  const prisma = db();
  if (!prisma || !/^[a-z0-9]{4,12}$/.test(code)) return null;
  const v = await prisma.vault.findUnique({ where: { code }, include: { creator: { select: creatorSelect } } });
  if (!v || v.hidden) return null;
  return toPublic(v);
}

/** Owner check for forks, replays and the death map. */
export async function vaultAccess(code: string, user: AuthedUser | null): Promise<{ creator: boolean; cracked: boolean }> {
  const prisma = db();
  if (!prisma || !user) return { creator: false, cracked: false };
  const v = await prisma.vault.findUnique({ where: { code }, select: { id: true, creatorId: true } });
  if (!v) return { creator: false, cracked: false };
  if (v.creatorId === user.id) return { creator: true, cracked: true };
  const c = await prisma.crack.findUnique({ where: { vaultId_userId: { vaultId: v.id, userId: user.id } }, select: { id: true } });
  return { creator: false, cracked: !!c };
}

export async function getVaultDefForRemix(code: string, user: AuthedUser | null): Promise<{ def: VaultDef; title: string } | null> {
  const access = await vaultAccess(code, user);
  if (!access.cracked) return null;
  const v = await getVault(code);
  return v ? { def: v.def, title: v.title } : null;
}

export interface BoardEntry {
  rank: number;
  turns: number;
  first: boolean;
  at: string;
  user: { handle: string; displayName: string | null; avatarUrl: string | null };
}

export async function vaultLeaderboard(code: string, take = 10): Promise<BoardEntry[]> {
  const prisma = db();
  if (!prisma) return [];
  const rows = await prisma.crack.findMany({
    where: { vault: { code } },
    orderBy: [{ turns: "asc" }, { createdAt: "asc" }],
    take,
    include: { user: { select: creatorSelect } },
  });
  return rows.map((r, i) => ({ rank: i + 1, turns: r.turns, first: r.first, at: r.updatedAt.toISOString(), user: r.user }));
}

/** Where players get caught: tile → count. */
export async function deathMap(code: string): Promise<{ x: number; y: number; n: number }[]> {
  const prisma = db();
  if (!prisma) return [];
  const v = await prisma.vault.findUnique({ where: { code }, select: { id: true, creatorId: true } });
  if (!v) return [];
  const rows = await prisma.attempt.groupBy({
    by: ["x", "y"],
    where: { vaultId: v.id, outcome: "caught", OR: [{ userId: null }, { userId: { not: v.creatorId } }] },
    _count: { _all: true },
  });
  return rows.map((r) => ({ x: r.x, y: r.y, n: r._count._all }));
}

export async function replays(code: string, take = 8): Promise<{ turns: number; moves: string; user: { handle: string; displayName: string | null } }[]> {
  const prisma = db();
  if (!prisma) return [];
  const rows = await prisma.crack.findMany({
    where: { vault: { code } },
    orderBy: [{ turns: "asc" }, { createdAt: "asc" }],
    take,
    include: { user: { select: { handle: true, displayName: true } } },
  });
  return rows.map((r) => ({ turns: r.turns, moves: r.moves, user: r.user }));
}

export type Sort = "trending" | "new" | "unbroken" | "hardest";

export interface VaultCard {
  code: string;
  title: string;
  def: VaultDef;
  rating: number;
  attempts: number;
  cracks: number;
  par: number;
  createdAt: string;
  creator: { handle: string; displayName: string | null };
}

function card(v: Prisma.VaultGetPayload<{ include: { creator: { select: { handle: true; displayName: true } } } }>): VaultCard {
  return {
    code: v.code,
    title: v.title,
    def: v.def as unknown as VaultDef,
    rating: v.rating,
    attempts: v.attempts,
    cracks: v.cracks,
    par: v.par,
    createdAt: v.createdAt.toISOString(),
    creator: v.creator,
  };
}

export async function listVaults(sort: Sort, take = 24): Promise<VaultCard[]> {
  await connection(); // live data: never prerender at build time
  const prisma = db();
  if (!prisma) return [];
  const include = { creator: { select: { handle: true, displayName: true } } } as const;
  const where = { hidden: false };
  if (sort === "new") return (await prisma.vault.findMany({ where, orderBy: { createdAt: "desc" }, take, include })).map(card);
  if (sort === "unbroken") {
    return (await prisma.vault.findMany({ where: { ...where, cracks: 0, attempts: { gte: 3 } }, orderBy: [{ attempts: "desc" }, { createdAt: "desc" }], take, include })).map(card);
  }
  if (sort === "hardest") {
    const ids = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Vault"
      WHERE "hidden" = false AND "attempts" >= 5
      ORDER BY ("cracks"::float / "attempts") ASC, "attempts" DESC
      LIMIT ${take}`;
    const rows = await prisma.vault.findMany({ where: { id: { in: ids.map((r) => r.id) } }, include });
    const order = new Map(ids.map((r, i) => [r.id, i]));
    return rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!).map(card);
  }
  // trending: the most runs in the last two days, then the most recently played
  const since = new Date(Date.now() - 2 * 86_400_000);
  const hot = await prisma.attempt.groupBy({ by: ["vaultId"], where: { createdAt: { gt: since } }, _count: { _all: true }, orderBy: { _count: { vaultId: "desc" } }, take });
  const rows = await prisma.vault.findMany({ where: { ...where, id: { in: hot.map((h) => h.vaultId) } }, include });
  const order = new Map(hot.map((h, i) => [h.vaultId, i]));
  const trending = rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  if (trending.length < take) {
    const more = await prisma.vault.findMany({ where: { ...where, id: { notIn: trending.map((v) => v.id) } }, orderBy: { lastPlayedAt: "desc" }, take: take - trending.length, include });
    trending.push(...more);
  }
  return trending.map(card);
}

export async function thiefLeaderboard(take = 50) {
  await connection(); // live data: never prerender at build time
  const prisma = db();
  if (!prisma) return [];
  const rows = await prisma.crack.groupBy({ by: ["userId"], _sum: { points: true }, _count: { _all: true }, orderBy: { _sum: { points: "desc" } }, take });
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, ...creatorSelect } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.flatMap((r, i) => {
    const u = byId.get(r.userId);
    return u ? [{ rank: i + 1, points: r._sum.points ?? 0, cracks: r._count._all, user: u }] : [];
  });
}

/** Builders ranked by how many thieves their vaults have caught. */
export async function builderLeaderboard(take = 50) {
  await connection(); // live data: never prerender at build time
  const prisma = db();
  if (!prisma) return [];
  const rows = await prisma.$queryRaw<{ creatorId: string; captures: bigint; vaults: bigint }[]>`
    SELECT "creatorId", SUM("attempts" - "cracks") AS captures, COUNT(*) AS vaults
    FROM "Vault" WHERE "hidden" = false
    GROUP BY "creatorId"
    ORDER BY captures DESC
    LIMIT ${take}`;
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.creatorId) } }, select: { id: true, ...creatorSelect } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.flatMap((r, i) => {
    const u = byId.get(r.creatorId);
    return u ? [{ rank: i + 1, captures: Number(r.captures), vaults: Number(r.vaults), user: u }] : [];
  });
}

export async function getProfile(handle: string) {
  const prisma = db();
  if (!prisma) return null;
  const u = await prisma.user.findUnique({ where: { handle }, select: { id: true, createdAt: true, ...creatorSelect } });
  if (!u) return null;
  const include = { creator: { select: { handle: true, displayName: true } } } as const;
  const [vaults, cracks, points] = await Promise.all([
    prisma.vault.findMany({ where: { creatorId: u.id, hidden: false }, orderBy: { createdAt: "desc" }, take: 60, include }),
    prisma.crack.findMany({ where: { userId: u.id, vault: { hidden: false } }, orderBy: { createdAt: "desc" }, take: 60, include: { vault: { include } } }),
    prisma.crack.aggregate({ where: { userId: u.id }, _sum: { points: true } }),
  ]);
  return {
    user: { handle: u.handle, displayName: u.displayName, avatarUrl: u.avatarUrl, since: u.createdAt.toISOString() },
    points: points._sum.points ?? 0,
    vaults: vaults.map(card),
    cracks: cracks.map((c) => ({ turns: c.turns, first: c.first, points: c.points, vault: card(c.vault) })),
    captures: vaults.reduce((s, v) => s + (v.attempts - v.cracks), 0),
  };
}

export async function hideVault(code: string, user: AuthedUser) {
  const prisma = need();
  const v = await prisma.vault.findUnique({ where: { code }, select: { id: true, creatorId: true } });
  if (!v) throw new HttpError(404, "vault not found");
  if (v.creatorId !== user.id) throw new HttpError(403, "only the builder can take a vault down");
  await prisma.vault.update({ where: { id: v.id }, data: { hidden: true } });
}

export async function siteStats(): Promise<{ vaults: number; attempts: number; cracks: number; caught: number } | null> {
  await connection();
  const prisma = db();
  if (!prisma) return null;
  const agg = await prisma.vault.aggregate({ where: { hidden: false }, _count: { _all: true }, _sum: { attempts: true, cracks: true } });
  const attempts = agg._sum.attempts ?? 0;
  const cracks = agg._sum.cracks ?? 0;
  return { vaults: agg._count._all, attempts, cracks, caught: attempts - cracks };
}

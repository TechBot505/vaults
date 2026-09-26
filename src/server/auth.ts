import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies, headers } from "next/headers";
import { clerkEnabled } from "./env";
import { db } from "./db";
import { HttpError } from "./http";

export interface AuthedUser {
  id: string;
  clerkId: string;
  handle: string;
}

const select = { id: true, clerkId: true, handle: true } as const;

/** Lowercase, url-safe handle from whatever name we have. */
function slug(s: string | null | undefined): string {
  const base = (s ?? "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  return base.length >= 2 ? base : "thief";
}

async function freeHandle(want: string): Promise<string> {
  const prisma = db()!;
  let h = want;
  for (let i = 0; i < 8; i++) {
    const taken = await prisma.user.findUnique({ where: { handle: h }, select: { id: true } });
    if (!taken) return h;
    h = `${want}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${want}-${Date.now().toString(36)}`;
}

async function ensureUser(clerkId: string, name: () => Promise<{ handle?: string | null; displayName?: string | null; avatarUrl?: string | null }>): Promise<AuthedUser> {
  const prisma = db()!;
  const existing = await prisma.user.findUnique({ where: { clerkId }, select });
  if (existing) return existing;
  const info = await name();
  const handle = await freeHandle(slug(info.handle ?? info.displayName));
  try {
    return await prisma.user.create({ data: { clerkId, handle, displayName: info.displayName ?? null, avatarUrl: info.avatarUrl ?? null }, select });
  } catch {
    // a concurrent request created it first
    const again = await prisma.user.findUnique({ where: { clerkId }, select });
    if (again) return again;
    throw new HttpError(500, "could not create user");
  }
}

/** The signed-in user's DB row (created on first sight), or null. */
export async function getUser(): Promise<AuthedUser | null> {
  const dev = await devUser();
  if (dev !== undefined) return dev;
  if (!clerkEnabled || !db()) return null;
  const { userId } = await auth();
  if (!userId) return null;
  return ensureUser(userId, async () => {
    const cu = await currentUser().catch(() => null);
    const displayName = [cu?.firstName, cu?.lastName].filter(Boolean).join(" ") || cu?.username || null;
    return { handle: cu?.username ?? cu?.firstName, displayName, avatarUrl: cu?.imageUrl };
  });
}

export async function requireUser(): Promise<AuthedUser> {
  if (!db()) throw new HttpError(503, "public vaults aren't set up on this server");
  const u = await getUser();
  if (!u) throw new HttpError(401, "sign in required");
  return u;
}

/**
 * Local/integration testing only: with VAULTS_DEV_AUTH=1 in a non-production
 * build, the `x-vaults-dev-user` header (or `vaults-dev-user` cookie) acts as a signed-in user. It can never
 * activate in production builds.
 */
async function devUser(): Promise<AuthedUser | null | undefined> {
  if (process.env.NODE_ENV === "production" || process.env.VAULTS_DEV_AUTH !== "1") return undefined;
  const id = (await headers()).get("x-vaults-dev-user") ?? (await cookies()).get("vaults-dev-user")?.value;
  if (!id || !db()) return undefined;
  const name = id.replace(/[^a-z0-9_-]/gi, "").slice(0, 32);
  return ensureUser(`dev_${name}`, async () => ({ handle: name, displayName: name }));
}

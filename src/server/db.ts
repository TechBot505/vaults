import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { databaseEnabled } from "./env";

type Client = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as { __vaultsPrisma?: Client };

/** Lazily created Prisma client; null when DATABASE_URL isn't configured. */
export function db(): Client | null {
  if (!databaseEnabled) return null;
  if (!globalForPrisma.__vaultsPrisma) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 5 });
    globalForPrisma.__vaultsPrisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.__vaultsPrisma;
}

export type Db = Client;

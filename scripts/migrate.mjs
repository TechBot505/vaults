/**
 * Runs `prisma migrate deploy` during the build when a database is configured.
 * Without DATABASE_URL the app builds in local-only mode and this is a no-op.
 * Set SKIP_MIGRATIONS=1 to opt out (e.g. preview deployments sharing a DB).
 */
import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("[vaults] DATABASE_URL not set: skipping migrations (public vaults off).");
  process.exit(0);
}
if (process.env.SKIP_MIGRATIONS === "1") {
  console.log("[vaults] SKIP_MIGRATIONS=1: skipping migrations.");
  process.exit(0);
}
try {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} catch {
  console.error("[vaults] migration failed. Check DATABASE_URL (use the direct, non-pooled connection string for migrations).");
  process.exit(1);
}

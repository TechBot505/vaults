import "dotenv/config";
import { defineConfig } from "prisma/config";

// DATABASE_URL is optional: without it the app runs without public vaults
// (share links still work). `prisma generate` works without a URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/vaults",
  },
});

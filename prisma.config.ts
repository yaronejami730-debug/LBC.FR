import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local for Prisma CLI (Next.js uses .env.local, not .env)
config({ path: ".env.local" });

// Migrations need a direct (unpooled) connection — Neon's pooled URL doesn't
// support the advisory locks required by prisma migrate deploy.
const MIGRATION_URL =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: MIGRATION_URL,
  },
});

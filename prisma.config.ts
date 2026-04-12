import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local for Prisma CLI (Next.js uses .env.local, not .env)
config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL!;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: DATABASE_URL,
  },
});

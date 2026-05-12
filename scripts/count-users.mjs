#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const client = new pg.Client({ connectionString: env.DATABASE_URL_UNPOOLED || env.DATABASE_URL });
await client.connect();

const q = async (sql) => (await client.query(sql)).rows[0];

const total = await q(`SELECT COUNT(*)::int AS n FROM "User"`);
const verified = await q(`SELECT COUNT(*)::int AS n FROM "User" WHERE "verified"=true AND "bannedAt" IS NULL`);
const marketing = await q(`SELECT COUNT(*)::int AS n FROM "User" WHERE "verified"=true AND "bannedAt" IS NULL AND "marketingConsent"=true`);

console.log("Total users:        ", total.n);
console.log("Verified, not banned:", verified.n);
console.log("Verified + marketing:", marketing.n);

await client.end();

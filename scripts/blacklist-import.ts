/**
 * Import des flux externes de domaines frauduleux dans la table `Blacklist`.
 *
 * À planifier en cron quotidien. Idempotent : `createMany` + `skipDuplicates`.
 *
 * Exécution :
 *   npx tsx scripts/blacklist-import.ts
 */
import "./load-env";
import { prisma } from "../lib/prisma";

type Source = { name: string; url: string };

/** Flux publics de domaines de phishing/scam (listes JSON de chaînes). */
const SOURCES: Source[] = [
  {
    name: "discord-antiscam",
    url: "https://raw.githubusercontent.com/Discord-AntiScam/scam-links/main/list.json",
  },
];

/** Extrait un hostname propre d'une entrée brute (domaine ou URL). */
function cleanDomain(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split("/")[0].split("?")[0].split("#")[0];
  // hostname plausible : au moins un point, caractères valides.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return null;
  return s;
}

const BATCH = 1000;

async function main() {
  let importedTotal = 0;

  for (const src of SOURCES) {
    process.stdout.write(`${src.name}… `);
    let entries: unknown;
    try {
      const res = await fetch(src.url);
      if (!res.ok) {
        console.log(`✗ HTTP ${res.status}`);
        continue;
      }
      entries = await res.json();
    } catch (err) {
      console.log(`✗ réseau (${err instanceof Error ? err.message : "erreur"})`);
      continue;
    }

    if (!Array.isArray(entries)) {
      console.log("✗ format inattendu (tableau attendu)");
      continue;
    }

    const domains = [...new Set(
      entries
        .filter((e): e is string => typeof e === "string")
        .map(cleanDomain)
        .filter((d): d is string => d !== null),
    )];

    let imported = 0;
    for (let i = 0; i < domains.length; i += BATCH) {
      const chunk = domains.slice(i, i + BATCH);
      const result = await prisma.blacklist.createMany({
        data: chunk.map((value) => ({ kind: "domain", value, source: src.name })),
        skipDuplicates: true,
      });
      imported += result.count;
    }
    importedTotal += imported;
    console.log(`✓ ${domains.length} domaines, ${imported} nouveaux`);
  }

  const total = await prisma.blacklist.count({ where: { kind: "domain" } });
  console.log(`\nBlacklist domaines : ${total} entrées (${importedTotal} ajoutées).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

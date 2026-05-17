/**
 * Import des flux externes de domaines frauduleux dans la table `Blacklist`.
 * Logique dans `lib/moderation/jobs.ts` (partagée avec la route cron).
 *
 *   npx tsx scripts/blacklist-import.ts
 */
import "./load-env";
import { prisma } from "../lib/prisma";
import { runBlacklistImport } from "../lib/moderation/jobs";

async function main() {
  const result = await runBlacklistImport(prisma);
  for (const s of result.sources) {
    console.log(
      s.ok
        ? `✓ ${s.name} : ${s.fetched} domaines, ${s.imported} nouveaux`
        : `✗ ${s.name} : échec`,
    );
  }
  console.log(`\nBlacklist domaines : ${result.totalDomains} entrées.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

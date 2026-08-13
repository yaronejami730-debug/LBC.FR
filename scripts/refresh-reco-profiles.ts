/**
 * Reconstruction manuelle des profils du moteur de recommandation.
 *
 * Le planificateur fait le même travail chaque nuit par lots de 500. Ce script
 * sert au premier remplissage — après la migration, aucun compte n'a de profil
 * et attendre 80 nuits pour couvrir 40 000 comptes n'aurait pas de sens.
 *
 *     npx tsx scripts/refresh-reco-profiles.ts            # 500 comptes
 *     npx tsx scripts/refresh-reco-profiles.ts --all      # jusqu'à épuisement
 *     npx tsx scripts/refresh-reco-profiles.ts --user=abc # un compte précis
 */

import { prisma } from "../lib/prisma";
import { refreshProfiles } from "../lib/recommendations/refresh";

async function main() {
  const args = process.argv.slice(2);
  const userArg = args.find((a) => a.startsWith("--user="))?.split("=")[1];

  if (userArg) {
    const result = await refreshProfiles({ userIds: [userArg] });
    const zones = await prisma.userLocationProfile.findMany({
      where: { userId: userArg },
      orderBy: { confidence: "desc" },
      select: { city: true, source: true, certainty: true, confidence: true, listingCount: true, viewCount: true },
    });
    const interests = await prisma.userCategoryInterest.findMany({
      where: { userId: userArg },
      orderBy: { score: "desc" },
      select: { categoryId: true, score: true },
    });

    console.log(JSON.stringify(result, null, 2));
    console.log("\nZones :");
    for (const z of zones) {
      console.log(
        `  ${z.city.padEnd(28)} ${z.source.padEnd(18)} ${z.certainty.padEnd(10)} ` +
          `confiance ${String(z.confidence).padStart(3)} (${z.listingCount} annonces, ${z.viewCount} vues)`,
      );
    }
    console.log("\nIntérêts :");
    for (const i of interests) console.log(`  ${i.categoryId.padEnd(20)} ${i.score}`);
    return;
  }

  const all = args.includes("--all");
  let total = 0;

  for (let round = 0; ; round++) {
    const result = await refreshProfiles({ limit: 500 });
    total += result.processed;
    console.log(
      `lot ${round + 1} — ${result.processed} comptes, ${result.withZones} localisés, ` +
        `${result.withInterests} avec intérêt, ${result.errors} erreurs`,
    );
    if (!all || result.processed === 0) break;
  }

  console.log(`\n${total} comptes traités.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

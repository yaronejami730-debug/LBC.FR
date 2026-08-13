/**
 * Rattrapage du géocodage des annonces existantes.
 *
 * À lancer une fois après la migration. Le moteur ne voit que les annonces
 * dont `geoLat` est renseigné : sans ce passage, la première campagne ne
 * trouverait que les annonces publiées depuis la mise en production.
 *
 *     npx tsx scripts/backfill-listing-geo.ts          # tout l'historique
 *     npx tsx scripts/backfill-listing-geo.ts --report # sans écrire
 */

import { prisma } from "../lib/prisma";
import { resolveLocation } from "../lib/geo/communes";
import { resolvePendingListingGeo } from "../lib/recommendations/listing-geo";

async function report() {
  const rows = await prisma.listing.findMany({
    where: { deletedAt: null },
    select: { location: true },
    take: 20_000,
  });

  const counts = { COMMUNE: 0, POSTAL: 0, DEPARTMENT: 0, ÉCHEC: 0 };
  const failures = new Map<string, number>();

  for (const row of rows) {
    const point = resolveLocation(row.location);
    if (point) counts[point.precision]++;
    else {
      counts["ÉCHEC"]++;
      const key = row.location.slice(0, 60) || "(vide)";
      failures.set(key, (failures.get(key) ?? 0) + 1);
    }
  }

  console.log(`\n${rows.length} annonces examinées`);
  for (const [key, value] of Object.entries(counts)) {
    const share = rows.length ? ((value / rows.length) * 100).toFixed(1) : "0";
    console.log(`  ${key.padEnd(11)} ${String(value).padStart(6)}  ${share} %`);
  }

  const worst = [...failures.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  if (worst.length) {
    console.log("\nLocalisations non résolues les plus fréquentes :");
    for (const [location, n] of worst) console.log(`  ${String(n).padStart(4)} × ${location}`);
  }
}

async function main() {
  if (process.argv.includes("--report")) {
    await report();
    return;
  }

  const result = await resolvePendingListingGeo({ batchSize: 1000, maxBatches: 1000 });
  console.log(
    `${result.scanned} annonces traitées — ${result.resolved} localisées, ${result.unresolved} sans coordonnées exploitables`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

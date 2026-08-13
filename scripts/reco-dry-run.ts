/**
 * Simulation d'une campagne de recommandation, en ligne de commande.
 *
 * Le même calcul que le CRON, sans le moindre envoi. À lancer avant toute mise
 * en production, et après chaque changement de seuil dans
 * `lib/recommendations/config.ts`.
 *
 *     npx tsx -r ./scripts/load-env.ts scripts/reco-dry-run.ts
 *     npx tsx -r ./scripts/load-env.ts scripts/reco-dry-run.ts --category=maison
 *     npx tsx -r ./scripts/load-env.ts scripts/reco-dry-run.ts --category=maison --lines
 */

import { prisma } from "../lib/prisma";
import { runRecommendationEngine } from "../lib/recommendations/engine";
import { RECO_CONFIG } from "../lib/recommendations/config";

async function main() {
  const args = process.argv.slice(2);
  const category = args.find((a) => a.startsWith("--category="))?.split("=")[1] ?? null;
  const showLines = args.includes("--lines");

  console.log(
    `Rayon ${RECO_CONFIG.radiusKm} km · score min ${RECO_CONFIG.minScore} · ` +
      `intérêt min ${RECO_CONFIG.minCategoryInterest} · fenêtre ${RECO_CONFIG.freshnessDays} j\n`,
  );

  const { geo, campaigns } = await runRecommendationEngine({ category, dryRun: true });
  console.log(
    `Géocodage : ${geo.scanned} annonces examinées, ${geo.resolved} localisées, ${geo.unresolved} en échec\n`,
  );

  for (const c of campaigns) {
    console.log(`── ${c.categoryLabel} ${"─".repeat(Math.max(0, 50 - c.categoryLabel.length))}`);
    console.log(`   annonces neuves    ${c.listingCount}`);
    console.log(`   comptes examinés   ${c.candidateUsers}`);
    console.log(`   comptes ciblés     ${c.targetedUsers}`);

    const exclusions = Object.entries(c.exclusions).sort((a, b) => b[1] - a[1]);
    if (exclusions.length) {
      console.log("   exclusions :");
      for (const [reason, n] of exclusions) console.log(`     ${String(n).padStart(5)} × ${reason}`);
    }

    if (showLines) {
      const retenues = c.lines.filter((l) => l.decision === "RETENUE").sort((a, b) => b.score - a.score);
      console.log(`   ${retenues.length} couples retenus :`);
      for (const l of retenues.slice(0, 40)) {
        console.log(
          `     ${l.email.padEnd(32)} ${l.listingTitle.slice(0, 34).padEnd(36)} ` +
            `${String(l.distanceKm).padStart(5)} km  cat ${String(l.categoryScore).padStart(2)}  ` +
            `zone ${String(l.locationScore).padStart(2)}  score ${String(l.score).padStart(3)}  ${l.certainty}`,
        );
      }
    }
    console.log();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

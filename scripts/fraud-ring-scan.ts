/**
 * Détection de fraude organisée — clustering de comptes par identifiants partagés.
 * Logique dans `lib/moderation/jobs.ts` (partagée avec la route cron).
 *
 *   npx tsx scripts/fraud-ring-scan.ts            → rapport seul (lecture)
 *   npx tsx scripts/fraud-ring-scan.ts --apply    → restreint les clusters confirmés
 */
import "./load-env";
import { prisma } from "../lib/prisma";
import { runFraudRingScan } from "../lib/moderation/jobs";

async function main() {
  const apply = process.argv.includes("--apply");
  const result = await runFraudRingScan(prisma, apply);

  console.log(`${result.analysed} annonces analysées.`);
  for (const c of result.clusters) {
    console.log(
      `\n⚠️  Cluster ${c.root.slice(0, 8)} — ${c.members.length} comptes` +
        ` | liens: ${c.links.join(", ")}${c.hasSanctioned ? " | contient un compte sanctionné" : ""}`,
    );
    console.log(`   comptes: ${c.members.join(", ")}`);
  }

  console.log(
    `\n${result.clusters.length} cluster(s) confirmé(s).` +
      (apply
        ? ` ${result.restricted} compte(s) restreint(s).`
        : " Mode lecture — relancer avec --apply pour restreindre."),
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

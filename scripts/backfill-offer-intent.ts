/**
 * Rattrapage des annonces publiées avant le moteur d'intention.
 *
 *   npm run intent:backfill -- --dry     # simulation, rien n'est écrit
 *   npm run intent:backfill              # écriture
 *
 * Deux choses à réparer sur l'existant :
 *   1. `condition` valait « Bon état » (ou « Good ») pour tout le monde, y
 *      compris pour des prestations, des offres d'emploi et des événements qui
 *      n'ont pas d'état. Ces valeurs remontaient dans les filtres.
 *   2. `metadata.intent` n'existait pas — la recherche et les recommandations
 *      n'ont donc rien pour distinguer une manucure d'un vernis à ongles.
 *
 * L'intention est recalculée depuis le titre et la description, jamais devinée
 * depuis la catégorie seule : c'est précisément parce que la catégorie mentait
 * que le problème existe.
 */

import { prisma } from "../lib/prisma";
import { inferOfferIntent } from "../lib/offer-intent";
import { fieldSetAsksCondition } from "../lib/offer-fields";

const DRY = process.argv.includes("--dry");
const BATCH = 500;

async function main() {
  const total = await prisma.listing.count({ where: { deletedAt: null } });
  console.log(`${total} annonces à examiner${DRY ? " (simulation)" : ""}.\n`);

  let cursor: string | null = null;
  let seen = 0;
  let conditionCleared = 0;
  let intentWritten = 0;
  const byNature: Record<string, number> = {};

  for (;;) {
    const rows: {
      id: string;
      title: string;
      description: string;
      category: string;
      subcategory: string | null;
      price: number;
      condition: string | null;
      metadata: string;
    }[] = await prisma.listing.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        subcategory: true,
        price: true,
        condition: true,
        metadata: true,
      },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      seen++;
      const intent = inferOfferIntent({
        title: row.title,
        description: row.description,
        categoryId: row.category,
        subcategory: row.subcategory,
        price: row.price,
      });
      byNature[intent.nature] = (byNature[intent.nature] ?? 0) + 1;

      const keepsCondition = fieldSetAsksCondition(intent.fieldSet);
      const clearsCondition = !keepsCondition && row.condition !== null;

      let meta: Record<string, unknown>;
      try {
        meta = JSON.parse(row.metadata || "{}");
      } catch {
        meta = {};
      }
      const stored = meta.intent as { version?: number } | undefined;
      const needsIntent = stored?.version !== intent.version;

      if (!clearsCondition && !needsIntent) continue;

      if (clearsCondition) conditionCleared++;
      if (needsIntent) intentWritten++;

      meta.intent = {
        nature: intent.nature,
        fieldSet: intent.fieldSet,
        confidence: intent.confidence,
        version: intent.version,
      };

      if (DRY) {
        if (clearsCondition) {
          console.log(
            `  ${row.title.slice(0, 60).padEnd(60)} ${intent.nature.padEnd(11)} état « ${row.condition} » retiré`,
          );
        }
        continue;
      }

      await prisma.listing.update({
        where: { id: row.id },
        data: {
          ...(clearsCondition ? { condition: null } : {}),
          metadata: JSON.stringify(meta),
        },
      });
    }

    console.log(`… ${seen}/${total}`);
  }

  console.log(`\nRépartition des natures :`);
  for (const [nature, n] of Object.entries(byNature).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${nature.padEnd(12)} ${n}`);
  }
  console.log(
    `\n${conditionCleared} états faux retirés, ${intentWritten} intentions écrites${DRY ? " (simulation — rien n'a été écrit)" : ""}.`,
  );
  console.log(
    `\nPensez à réindexer OpenSearch ensuite : npm run search:reindex`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

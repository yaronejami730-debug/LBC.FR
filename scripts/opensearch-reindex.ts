/**
 * Réindexe toutes les annonces non supprimées depuis PostgreSQL vers OpenSearch.
 *   npm run search:reindex
 */
import "./load-env";
import { isOpenSearchEnabled } from "../lib/opensearch";
import { ensureIndex } from "../lib/opensearch-index";
import { bulkIndexListings } from "../lib/opensearch-sync";
import { prisma } from "../lib/prisma";

const BATCH = 500;

async function main() {
  if (!isOpenSearchEnabled()) {
    console.error("✗ OPENSEARCH_URL non défini — abandon.");
    process.exit(1);
  }
  await ensureIndex();

  const total = await prisma.listing.count({ where: { deletedAt: null } });
  console.log(`${total} annonce(s) à indexer…`);

  let done = 0;
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.listing.findMany({
      where: { deletedAt: null },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (batch.length === 0) break;
    await bulkIndexListings(batch);
    done += batch.length;
    cursor = batch[batch.length - 1].id;
    console.log(`  ${done}/${total}`);
  }

  console.log(`✓ ${done} annonce(s) indexée(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Échec reindex:", err);
  process.exit(1);
});

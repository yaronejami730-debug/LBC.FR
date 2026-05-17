/**
 * Crée (ou recrée) l'index OpenSearch `listings` avec l'analyseur FR.
 *   npm run search:setup
 *
 * ⚠️ Recrée l'index → perte des documents. Lancer `search:reindex` ensuite.
 */
import "./load-env";
import { isOpenSearchEnabled } from "../lib/opensearch";
import { recreateIndex } from "../lib/opensearch-index";

async function main() {
  if (!isOpenSearchEnabled()) {
    console.error("✗ OPENSEARCH_URL non défini — abandon.");
    process.exit(1);
  }
  console.log("Recréation de l'index 'listings'…");
  await recreateIndex();
  console.log("✓ Index 'listings' créé (analyseur FR + synonymes + fuzzy).");
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Échec setup:", err);
  process.exit(1);
});

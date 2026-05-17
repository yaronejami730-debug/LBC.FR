/**
 * Synchronisation des annonces vers OpenSearch.
 *
 * Toutes les fonctions sont des no-op silencieux si OpenSearch est désactivé,
 * et sont conçues pour un usage « fire-and-forget » (ne jamais bloquer ni
 * faire échouer une requête applicative).
 */

import { getClient, LISTINGS_INDEX } from "./opensearch";
import { ensureIndex, listingToDocument, type IndexableListing } from "./opensearch-index";

/** Indexe (ou met à jour) une annonce. */
export async function indexListing(listing: IndexableListing): Promise<void> {
  const client = getClient();
  if (!client) return;
  await ensureIndex();
  await client.index({
    index: LISTINGS_INDEX,
    id: listing.id,
    body: listingToDocument(listing),
    refresh: true,
  });
}

/** Retire une annonce de l'index (suppression / soft-delete). */
export async function deleteListingFromIndex(id: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.delete({ index: LISTINGS_INDEX, id, refresh: true });
  } catch (err: unknown) {
    // 404 = déjà absent → non bloquant.
    const status = (err as { meta?: { statusCode?: number } })?.meta?.statusCode;
    if (status !== 404) throw err;
  }
}

/** Indexe un lot d'annonces via l'API bulk. Renvoie le nombre indexé. */
export async function bulkIndexListings(listings: IndexableListing[]): Promise<number> {
  const client = getClient();
  if (!client || listings.length === 0) return 0;
  await ensureIndex();

  const body = listings.flatMap((l) => [
    { index: { _index: LISTINGS_INDEX, _id: l.id } },
    listingToDocument(l),
  ]);

  const res = await client.bulk({ body, refresh: false });
  if (res.body.errors) {
    const firstError = res.body.items.find(
      (it: { index?: { error?: unknown } }) => it.index?.error,
    );
    throw new Error(`Bulk index échec: ${JSON.stringify(firstError?.index?.error)}`);
  }
  return listings.length;
}

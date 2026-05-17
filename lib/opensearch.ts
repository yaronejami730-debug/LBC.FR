/**
 * Client OpenSearch — singleton paresseux.
 *
 * Activé uniquement si `OPENSEARCH_URL` est défini. Sinon `getClient()`
 * renvoie null et toute la couche recherche retombe sur PostgreSQL :
 * l'application fonctionne identiquement sans cluster.
 *
 * Variables d'env :
 *   OPENSEARCH_URL       — ex. http://localhost:9200 ou https://...:9200
 *   OPENSEARCH_USERNAME  — optionnel (clusters sécurisés)
 *   OPENSEARCH_PASSWORD  — optionnel
 */

import { Client } from "@opensearch-project/opensearch";

/** Nom de l'index des annonces. */
export const LISTINGS_INDEX = "listings";

let cached: Client | null | undefined;

/** true si un cluster OpenSearch est configuré. */
export function isOpenSearchEnabled(): boolean {
  return Boolean(process.env.OPENSEARCH_URL);
}

/** Client OpenSearch, ou null si non configuré. */
export function getClient(): Client | null {
  if (cached !== undefined) return cached;

  const node = process.env.OPENSEARCH_URL;
  if (!node) {
    cached = null;
    return null;
  }

  const username = process.env.OPENSEARCH_USERNAME;
  const password = process.env.OPENSEARCH_PASSWORD;

  cached = new Client({
    node,
    ...(username && password ? { auth: { username, password } } : {}),
    // Clusters managés : certificats auto-signés tolérés.
    ssl: { rejectUnauthorized: false },
    requestTimeout: 10_000,
    maxRetries: 2,
  });

  return cached;
}

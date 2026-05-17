/**
 * Recherche d'annonces via OpenSearch.
 *
 * Réplique la logique de filtrage de buildSearchWhere (lib/search-where.ts)
 * en DSL OpenSearch : full-text fuzzy + synonymes + filtres structurés.
 *
 * Renvoie uniquement les IDs ordonnés + le total ; l'appelant hydrate
 * les lignes depuis PostgreSQL (données fraîches, forme de réponse stable).
 */

import { getClient, LISTINGS_INDEX } from "./opensearch";
import type { SearchParams } from "./search-where";
import { CATEGORIES } from "./categories";

// Mêmes ensembles de clés que buildSearchWhere — gardés en phase.
const SUBCATEGORY_FILTER_KEYS = new Set([
  "vehicleType", "propertyType", "transactionType", "deviceType",
  "animalType", "accommodationType", "serviceType", "communityType", "sector",
]);
const METADATA_FILTER_KEYS = new Set([
  "fuel", "gearbox", "size", "contractType",
  "experience", "animalAge", "childAge", "capacity",
]);
const SKIP_KEYS = new Set([
  "q", "category", "minPrice", "maxPrice", "location", "condition",
  "sort", "page", "_filters",
  "minKm", "maxKm", "minYear", "maxYear",
  "minSurface", "maxSurface", "minRooms", "maxRooms",
]);

function resolveCategoryLabel(raw: string): string {
  const hit = CATEGORIES.find(
    (c) => c.id === raw || c.label.toLowerCase() === raw.toLowerCase(),
  );
  return hit ? hit.label : raw;
}

function num(v: string | null | undefined): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export type SearchHits = { ids: string[]; total: number };

/**
 * Exécute une recherche. `page` est 1-indexé.
 * Lève une erreur si OpenSearch n'est pas configuré — l'appelant doit
 * vérifier isOpenSearchEnabled() et prévoir un repli PostgreSQL.
 */
export async function searchListings(
  params: SearchParams,
  page: number,
  perPage: number,
  opts: { includeNonApproved?: boolean } = {},
): Promise<SearchHits> {
  const client = getClient();
  if (!client) throw new Error("OpenSearch non configuré");

  const q = params.q?.trim() || "";
  const filter: object[] = [];

  // Visibilité publique
  if (!opts.includeNonApproved) {
    filter.push({ term: { status: "APPROVED" } });
    filter.push({ term: { shadowBanned: false } });
  }

  // Catégorie — match exact sur le libellé stocké
  if (params.category) {
    filter.push({ term: { category: resolveCategoryLabel(params.category) } });
  }

  // Prix
  const minPrice = num(params.minPrice);
  const maxPrice = num(params.maxPrice);
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.push({
      range: {
        price: {
          ...(minPrice !== undefined && { gte: minPrice }),
          ...(maxPrice !== undefined && { lte: maxPrice }),
        },
      },
    });
  }

  // Localisation / état — match analysé (tolérant)
  if (params.location?.trim()) {
    filter.push({ match: { location: params.location.trim() } });
  }
  if (params.condition?.trim()) {
    filter.push({ match: { condition: params.condition.trim() } });
  }

  // Plages numériques sur colonnes dédiées
  const ranges: [string, string, string][] = [
    ["vehicleKm", "minKm", "maxKm"],
    ["vehicleYear", "minYear", "maxYear"],
    ["immoSurface", "minSurface", "maxSurface"],
    ["immoRooms", "minRooms", "maxRooms"],
  ];
  for (const [field, minKey, maxKey] of ranges) {
    const lo = num(params[minKey]);
    const hi = num(params[maxKey]);
    if (lo !== undefined || hi !== undefined) {
      filter.push({
        range: {
          [field]: {
            ...(lo !== undefined && { gte: lo }),
            ...(hi !== undefined && { lte: hi }),
          },
        },
      });
    }
  }

  // Filtres sous-catégorie + métadonnées (clés dynamiques)
  for (const [key, value] of Object.entries(params)) {
    if (!value || SKIP_KEYS.has(key)) continue;
    if (SUBCATEGORY_FILTER_KEYS.has(key)) {
      filter.push({ match: { subcategory: value } });
    } else if (METADATA_FILTER_KEYS.has(key)) {
      filter.push({ match: { metadataText: value } });
    }
  }

  // Clause full-text fuzzy + synonymes
  const must = q
    ? [
        {
          multi_match: {
            query: q,
            fields: [
              "title^4",
              "brand^3",
              "subcategory^2",
              "description",
              "location",
              "metadataText",
            ],
            type: "best_fields",
            fuzziness: "AUTO",
            prefix_length: 1,
            minimum_should_match: "70%",
          },
        },
      ]
    : [{ match_all: {} }];

  // Tri : pertinence pour les requêtes texte, récence sinon
  let sort: (string | Record<string, string>)[];
  if (params.sort === "price-asc") sort = [{ price: "asc" }];
  else if (params.sort === "price-desc") sort = [{ price: "desc" }];
  else if (q) sort = ["_score", { createdAt: "desc" }];
  else sort = [{ createdAt: "desc" }];

  const from = Math.max(0, (page - 1) * perPage);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await client.search({
    index: LISTINGS_INDEX,
    body: {
      query: { bool: { must, filter } },
      sort,
      from,
      size: perPage,
      _source: false,
      track_total_hits: true,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  const hits = res.body.hits;
  const totalRaw = hits.total;
  const total = typeof totalRaw === "number" ? totalRaw : (totalRaw?.value ?? 0);

  return {
    ids: hits.hits.map((h: { _id: string }) => h._id),
    total,
  };
}

// ─────────────────────────────────────────────────────────────
// SUGGESTIONS — autocomplétion pour la barre de recherche
// ─────────────────────────────────────────────────────────────

export type SuggestionResult = {
  ids: string[];
  categories: { name: string; count: number }[];
};

/**
 * Suggestions de recherche : top annonces par pertinence + top catégories.
 *
 * Combine `match_phrase_prefix` (préfixe avant frappe complète) et
 * `multi_match` fuzzy (tolérance fautes) — la frappe partielle « sech li »
 * remonte « Sèche-linge », « bosh » remonte « Bosch ».
 *
 * Un seul aller-retour OpenSearch (résultats + agrégation catégories).
 * Lève une erreur si le cluster n'est pas configuré.
 */
export async function suggestListings(
  q: string,
  opts: { listingLimit?: number; categoryLimit?: number } = {},
): Promise<SuggestionResult> {
  const client = getClient();
  if (!client) throw new Error("OpenSearch non configuré");

  const listingLimit = opts.listingLimit ?? 6;
  const categoryLimit = opts.categoryLimit ?? 3;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await client.search({
    index: LISTINGS_INDEX,
    body: {
      size: listingLimit,
      _source: false,
      track_total_hits: false,
      query: {
        bool: {
          filter: [
            { term: { status: "APPROVED" } },
            { term: { shadowBanned: false } },
          ],
          should: [
            // Préfixe — réagit à mi-frappe (« sech li » → « sèche-linge »)
            { match_phrase_prefix: { title: { query: q, boost: 4 } } },
            { match_phrase_prefix: { brand: { query: q, boost: 3 } } },
            { match_phrase_prefix: { subcategory: { query: q, boost: 2 } } },
            // Fuzzy — tolère les fautes (« bosh » → « bosch »)
            {
              multi_match: {
                query: q,
                fields: ["title^3", "brand^2", "subcategory", "description"],
                fuzziness: "AUTO",
                prefix_length: 1,
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
      aggs: {
        top_categories: {
          terms: { field: "category", size: categoryLimit },
        },
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  const ids = (res.body.hits?.hits ?? []).map((h: { _id: string }) => h._id);
  const buckets =
    (res.body.aggregations?.top_categories?.buckets ?? []) as { key: string; doc_count: number }[];
  const categories = buckets.map((b) => ({ name: b.key, count: b.doc_count }));

  return { ids, categories };
}

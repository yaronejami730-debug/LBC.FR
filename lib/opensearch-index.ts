/**
 * Configuration de l'index `listings` : analyseur français, synonymes,
 * fuzzy-ready, + mapping des champs et conversion Listing → document.
 *
 * Analyseurs :
 *   fr_index   — indexation : élision + minuscule + asciifolding + stop + stemmer
 *   fr_search  — recherche  : idem + synonym_graph (synonymes appliqués
 *                à la requête, donc modifiables sans réindexer)
 */

import { getClient, LISTINGS_INDEX } from "./opensearch";
import { FR_SYNONYMS } from "./synonyms-fr";

// ─────────────────────────────────────────────────────────────
// SETTINGS / MAPPINGS
// ─────────────────────────────────────────────────────────────

const FR_ELISION_ARTICLES = [
  "l", "m", "t", "qu", "n", "s", "j", "d", "c",
  "jusqu", "quoiqu", "lorsqu", "puisqu",
];

const INDEX_SETTINGS = {
  index: { number_of_shards: 1, number_of_replicas: 0 },
  analysis: {
    filter: {
      fr_elision: { type: "elision", articles_case: true, articles: FR_ELISION_ARTICLES },
      fr_stop: { type: "stop", stopwords: "_french_" },
      fr_stemmer: { type: "stemmer", language: "light_french" },
      fr_synonyms: { type: "synonym_graph", synonyms: FR_SYNONYMS },
    },
    analyzer: {
      fr_index: {
        type: "custom",
        tokenizer: "standard",
        filter: ["fr_elision", "lowercase", "asciifolding", "fr_stop", "fr_stemmer"],
      },
      fr_search: {
        type: "custom",
        tokenizer: "standard",
        filter: ["fr_elision", "lowercase", "asciifolding", "fr_synonyms", "fr_stop", "fr_stemmer"],
      },
    },
  },
};

// Champ texte FR : analysé pour le full-text, sous-champ .kw pour le tri/filtre exact.
const frText = {
  type: "text",
  analyzer: "fr_index",
  search_analyzer: "fr_search",
  fields: { kw: { type: "keyword", ignore_above: 256 } },
};

const INDEX_MAPPINGS = {
  properties: {
    title: frText,
    description: { type: "text", analyzer: "fr_index", search_analyzer: "fr_search" },
    brand: frText,
    subcategory: frText,
    location: frText,
    condition: frText,
    metadataText: { type: "text", analyzer: "fr_index", search_analyzer: "fr_search" },

    category: { type: "keyword" },
    status: { type: "keyword" },
    shadowBanned: { type: "boolean" },
    detectedBrand: { type: "keyword" },
    detectedModel: { type: "keyword" },

    price: { type: "float" },
    vehicleKm: { type: "integer" },
    vehicleYear: { type: "integer" },
    immoSurface: { type: "float" },
    immoRooms: { type: "integer" },
    createdAt: { type: "date" },
  },
};

// ─────────────────────────────────────────────────────────────
// GESTION DE L'INDEX
// ─────────────────────────────────────────────────────────────

/** Crée l'index s'il n'existe pas. No-op si OpenSearch désactivé. */
export async function ensureIndex(): Promise<void> {
  const client = getClient();
  if (!client) return;

  const exists = await client.indices.exists({ index: LISTINGS_INDEX });
  if (exists.body) return;

  await client.indices.create({
    index: LISTINGS_INDEX,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: { settings: INDEX_SETTINGS, mappings: INDEX_MAPPINGS } as any,
  });
}

/** Supprime puis recrée l'index (perte de données — réservé au setup/reindex). */
export async function recreateIndex(): Promise<void> {
  const client = getClient();
  if (!client) throw new Error("OPENSEARCH_URL non défini");

  const exists = await client.indices.exists({ index: LISTINGS_INDEX });
  if (exists.body) {
    await client.indices.delete({ index: LISTINGS_INDEX });
  }
  await client.indices.create({
    index: LISTINGS_INDEX,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: { settings: INDEX_SETTINGS, mappings: INDEX_MAPPINGS } as any,
  });
}

// ─────────────────────────────────────────────────────────────
// CONVERSION Listing → document OpenSearch
// ─────────────────────────────────────────────────────────────

/** Champs minimum requis pour indexer une annonce. */
export type IndexableListing = {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string | null;
  location: string;
  condition: string;
  brand: string | null;
  price: number;
  status: string;
  shadowBanned: boolean;
  metadata: string;
  vehicleKm: number | null;
  vehicleYear: number | null;
  immoSurface: number | null;
  immoRooms: number | null;
  createdAt: Date | string;
};

/** Aplatit le JSON `metadata` en texte cherchable + extrait les attributs détectés. */
function parseMetadata(metadata: string): { text: string; brand: string | null; model: string | null } {
  try {
    const obj = JSON.parse(metadata || "{}") as Record<string, unknown>;
    const text = Object.values(obj)
      .filter((v) => typeof v === "string" || typeof v === "number")
      .join(" ");
    return {
      text,
      brand: typeof obj.detectedBrand === "string" ? obj.detectedBrand : null,
      model: typeof obj.detectedModel === "string" ? obj.detectedModel : null,
    };
  } catch {
    return { text: "", brand: null, model: null };
  }
}

export function listingToDocument(listing: IndexableListing) {
  const meta = parseMetadata(listing.metadata);
  return {
    title: listing.title,
    description: listing.description,
    category: listing.category,
    subcategory: listing.subcategory ?? "",
    location: listing.location,
    condition: listing.condition,
    brand: listing.brand ?? "",
    price: listing.price,
    status: listing.status,
    shadowBanned: listing.shadowBanned,
    metadataText: meta.text,
    detectedBrand: meta.brand,
    detectedModel: meta.model,
    vehicleKm: listing.vehicleKm,
    vehicleYear: listing.vehicleYear,
    immoSurface: listing.immoSurface,
    immoRooms: listing.immoRooms,
    createdAt:
      listing.createdAt instanceof Date
        ? listing.createdAt.toISOString()
        : listing.createdAt,
  };
}

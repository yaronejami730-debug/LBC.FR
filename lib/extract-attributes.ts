/**
 * Extraction d'attributs structurés depuis le texte libre d'une annonce.
 *
 * Réutilise les listes `brands` / `models` de la taxonomie
 * (categories-classifier.json — 862 marques, 844 modèles) + les marques
 * auto de carBrands.ts. Aucun appel réseau, aucune IA générative :
 * matching exact mot/phrase contre un index construit au chargement.
 *
 * @example
 *   extractAttributes("pare-chocs avant BMW Série 1 F20 de 2014")
 *   → { brand: "BMW", model: "F20", year: 2014, brands: ["BMW"], models: ["F20"] }
 */

import categoriesData from "./categories-classifier.json";
import { CAR_BRANDS } from "./carBrands";
import { foldAccents } from "./normalize-fr";

export type ExtractedAttributes = {
  /** Marque principale détectée (forme d'affichage), ou null. */
  brand: string | null;
  /** Modèle principal détecté (forme d'affichage), ou null. */
  model: string | null;
  /** Année (1950-2049) détectée, ou null. */
  year: number | null;
  /** Toutes les marques détectées. */
  brands: string[];
  /** Tous les modèles détectés. */
  models: string[];
};

// ─────────────────────────────────────────────────────────────
// 1. NORMALISATION
// ─────────────────────────────────────────────────────────────

function norm(s: string): string {
  return foldAccents(s)
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Forme d'affichage : codes courts en majuscules, sinon Capitalisation. */
function toDisplay(term: string): string {
  if (term.length <= 3 || /^[a-z]?\d/.test(term)) return term.toUpperCase();
  return term
    .split(/([\s-])/)
    .map((part) => (/[\s-]/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

// ─────────────────────────────────────────────────────────────
// 2. INDEX (construit une fois au chargement du module)
// ─────────────────────────────────────────────────────────────

type TermIndex = {
  /** mot unique normalisé → forme d'affichage */
  single: Map<string, string>;
  /** phrases multi-mots, triées du plus long au plus court */
  phrases: { norm: string; display: string }[];
};

function buildIndex(...sources: string[][]): TermIndex {
  const single = new Map<string, string>();
  const phrases: { norm: string; display: string; words: number }[] = [];
  const seen = new Set<string>();

  for (const src of sources) {
    for (const raw of src) {
      const n = norm(raw);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      const words = n.split(" ").length;
      if (words === 1) {
        // Mots trop courts/génériques → trop de faux positifs
        if (n.length < 2) continue;
        single.set(n, toDisplay(n));
      } else {
        phrases.push({ norm: n, display: toDisplay(n), words });
      }
    }
  }
  phrases.sort((a, b) => b.words - a.words);
  return { single, phrases: phrases.map(({ norm, display }) => ({ norm, display })) };
}

// Agrège marques + modèles depuis la taxonomie.
type RawCategory = { subcategories?: { brands?: string[]; models?: string[] }[] };
const jsonBrands: string[] = [];
const jsonModels: string[] = [];
for (const cat of (categoriesData as { categories?: RawCategory[] }).categories ?? []) {
  for (const sub of cat.subcategories ?? []) {
    if (sub.brands) jsonBrands.push(...sub.brands);
    if (sub.models) jsonModels.push(...sub.models);
  }
}

const BRAND_INDEX = buildIndex(jsonBrands, CAR_BRANDS.map((b) => b.name));
const MODEL_INDEX = buildIndex(jsonModels);

// ─────────────────────────────────────────────────────────────
// 3. MATCHING
// ─────────────────────────────────────────────────────────────

function findTerms(text: string, index: TermIndex): string[] {
  const padded = ` ${norm(text)} `;
  const hits: string[] = [];
  const used = new Set<string>();

  // Phrases d'abord (plus spécifiques).
  for (const p of index.phrases) {
    if (padded.includes(` ${p.norm} `) && !used.has(p.display)) {
      used.add(p.display);
      hits.push(p.display);
    }
  }
  // Puis mots uniques.
  for (const token of padded.trim().split(" ")) {
    const display = index.single.get(token);
    if (display && !used.has(display)) {
      used.add(display);
      hits.push(display);
    }
  }
  return hits;
}

// ─────────────────────────────────────────────────────────────
// 4. API PUBLIQUE
// ─────────────────────────────────────────────────────────────

export function extractAttributes(text: string): ExtractedAttributes {
  if (!text || typeof text !== "string") {
    return { brand: null, model: null, year: null, brands: [], models: [] };
  }

  const brands = findTerms(text, BRAND_INDEX);
  const models = findTerms(text, MODEL_INDEX);

  // Année : 1950-2049, isolée (évite codes postaux, kilométrages).
  const yearMatch = norm(text).match(/\b(19[5-9]\d|20[0-4]\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  return {
    brand: brands[0] ?? null,
    model: models[0] ?? null,
    year,
    brands,
    models,
  };
}

/** Tailles des index — diagnostics / tests. */
export const ATTRIBUTE_INDEX_STATS = {
  brands: BRAND_INDEX.single.size + BRAND_INDEX.phrases.length,
  models: MODEL_INDEX.single.size + MODEL_INDEX.phrases.length,
};

/**
 * Client du catalogue de prestations PRO (30 catégories, 2 200 prestations).
 *
 * Rien n'est embarqué dans l'app : le catalogue pèse 3,5 Mo et change sans
 * passer par l'App Store. Tout vient de /api/taxonomy/pro, une branche à la
 * fois. Les types dupliquent volontairement `lib/pro-catalog/types.ts` du web —
 * les deux projets TypeScript sont séparés, comme pour `lib/categories.ts`.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "./api";

export type ProFieldType =
  | "boolean"
  | "date"
  | "document"
  | "duration"
  | "media"
  | "multiselect"
  | "number"
  | "percent"
  | "price"
  | "range"
  | "schedule"
  | "select"
  | "text"
  | "zone";

export type ProFieldDefinition = {
  id: string;
  label: string;
  type: ProFieldType;
  options: string[] | null;
};

export type ProLeaf = {
  id: string;
  slug: string;
  label: string;
  path: [string, string, string];
  base_label: string;
  variant: string | null;
  keywords: string[];
  fields: string[];
  domain: string;
  requires_qualification: string[];
  regulated: boolean;
  pro_only: boolean;
};

export type ProSubcategoryOutline = { id: string; slug: string; label: string; count: number };

export type ProCategoryOutline = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  domain: string;
  count: number;
  default_fields: string[];
  variants: string[];
  subcategories: ProSubcategoryOutline[];
};

export type ProCategory = ProCategoryOutline & {
  children: (ProSubcategoryOutline & { children: ProLeaf[] })[];
};

export type ProActivityDomain = {
  id: string;
  label: string;
  allowed_categories: string[];
  adjacent_categories: string[];
};

export type ProCoherenceLevel = "allow" | "review" | "block";

export type ProSuggestion = {
  id: string;
  label: string;
  cat: string;
  sub: string;
  domain: string;
  slug: string;
  kw: string[];
  f: string[];
  score: number;
};

type Meta = { version: string; generatedAt: string };

const OUTLINE_CACHE_KEY = "proCatalog.outline.v1";

/**
 * Plan du catalogue, servi depuis le cache disque puis rafraîchi. Le plan seul
 * fait quelques dizaines de Ko : on peut le garder sans risque, contrairement
 * aux feuilles.
 */
export async function loadProOutline(): Promise<ProCategoryOutline[]> {
  const cached = await AsyncStorage.getItem(OUTLINE_CACHE_KEY).catch(() => null);
  const fallback = cached ? (JSON.parse(cached) as ProCategoryOutline[]) : [];

  try {
    const fresh = await apiFetch<Meta & { categories: ProCategoryOutline[] }>(
      "/api/taxonomy/pro?view=outline",
      { auth: false },
    );
    if (fresh?.categories?.length) {
      AsyncStorage.setItem(OUTLINE_CACHE_KEY, JSON.stringify(fresh.categories)).catch(() => {});
      return fresh.categories;
    }
  } catch {
    // Hors ligne : le plan en cache reste utilisable pour naviguer.
  }
  return fallback;
}

/** Une catégorie et toutes ses prestations. À appeler quand l'utilisateur l'ouvre. */
export function fetchProCategory(id: string) {
  return apiFetch<Meta & { category: ProCategory }>(
    `/api/taxonomy/pro?view=category&id=${encodeURIComponent(id)}`,
    { auth: false },
  );
}

/** Prestation + champs résolus, prêts à générer le formulaire. */
export function fetchProLeaf(id: string) {
  return apiFetch<Meta & { leaf: ProLeaf; fields: ProFieldDefinition[] }>(
    `/api/taxonomy/pro?view=leaf&id=${encodeURIComponent(id)}`,
    { auth: false },
  );
}

export function fetchProDomains() {
  return apiFetch<Meta & { domains: ProActivityDomain[] }>("/api/taxonomy/pro?view=domains", {
    auth: false,
  });
}

/**
 * Cohérence métier : sert à afficher l'avertissement avant publication. Le
 * serveur rejoue la vérification à la publication — ne jamais s'y fier seul.
 */
export function fetchProCoherence(params: {
  domain: string;
  secondary?: string[];
  node: string;
}) {
  const qs = new URLSearchParams({ view: "coherence", domain: params.domain, node: params.node });
  if (params.secondary?.length) qs.set("secondary", params.secondary.join(","));
  return apiFetch<
    Meta & {
      level: ProCoherenceLevel;
      matchedDomain: string | null;
      reason: string;
      allowedCategories: { id: string; label: string }[];
      adjacentCategories: { id: string; label: string }[];
    }
  >(`/api/taxonomy/pro?${qs}`, { auth: false });
}

export type ProSuggestParams = {
  q?: string;
  /** Texte libre décrivant l'activité : renvoie les prestations les plus proches. */
  prompt?: string;
  limit?: number;
  domains?: string[];
  categoryIds?: string[];
  signal?: AbortSignal;
};

/**
 * Autosuggestion. Passer un `signal` à chaque frappe et annuler la requête
 * précédente, sinon les réponses arrivent dans le désordre et la liste
 * clignote.
 */
export async function suggestProLeaves(params: ProSuggestParams): Promise<ProSuggestion[]> {
  const qs = new URLSearchParams();
  if (params.prompt) qs.set("prompt", params.prompt);
  else qs.set("q", params.q ?? "");
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.domains?.length) qs.set("domains", params.domains.join(","));
  if (params.categoryIds?.length) qs.set("categories", params.categoryIds.join(","));

  try {
    const res = await apiFetch<{ results: ProSuggestion[] }>(`/api/taxonomy/pro/suggest?${qs}`, {
      auth: false,
      signal: params.signal,
    });
    return res?.results ?? [];
  } catch {
    // Une suggestion qui échoue ne doit jamais bloquer la saisie.
    return [];
  }
}

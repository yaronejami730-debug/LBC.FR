/**
 * Client du catalogue PRO pour le navigateur.
 *
 * N'importe que des types : aucun des 3,5 Mo de JSON n'atterrit dans le bundle
 * client. Tout passe par /api/taxonomy/pro, qui ne renvoie qu'une branche à la
 * fois.
 */
import type {
  ProCategoryResponse,
  ProCoherenceResponse,
  ProDomainsResponse,
  ProFieldsResponse,
  ProLeafResponse,
  ProOutlineResponse,
  ProSuggestResponse,
} from "./types";

export type * from "./types";

const BASE = "/api/taxonomy/pro";

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Catalogue PRO indisponible (HTTP ${res.status})`);
  }
  return (await res.json()) as T;
}

/** Catégories + sous-catégories. Point de départ de la navigation. */
export function fetchProOutline(signal?: AbortSignal) {
  return get<ProOutlineResponse>(`${BASE}?view=outline`, signal);
}

/** Une catégorie avec toutes ses prestations — à charger à l'ouverture, pas avant. */
export function fetchProCategory(id: string, signal?: AbortSignal) {
  return get<ProCategoryResponse>(`${BASE}?view=category&id=${encodeURIComponent(id)}`, signal);
}

/** Prestation + définitions de champs résolues, prêtes à générer le formulaire. */
export function fetchProLeaf(id: string, signal?: AbortSignal) {
  return get<ProLeafResponse>(`${BASE}?view=leaf&id=${encodeURIComponent(id)}`, signal);
}

export function fetchProFields(signal?: AbortSignal) {
  return get<ProFieldsResponse>(`${BASE}?view=fields`, signal);
}

export function fetchProDomains(signal?: AbortSignal) {
  return get<ProDomainsResponse>(`${BASE}?view=domains`, signal);
}

/**
 * Verdict de cohérence avant publication. À rejouer côté serveur au moment de
 * publier : cet appel sert à afficher l'avertissement, pas à autoriser.
 */
export function fetchProCoherence(
  params: { domain: string; secondary?: string[]; node: string },
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams({ view: "coherence", domain: params.domain, node: params.node });
  if (params.secondary?.length) qs.set("secondary", params.secondary.join(","));
  return get<ProCoherenceResponse>(`${BASE}?${qs}`, signal);
}

export type ProSuggestParams = {
  /** Recherche tapée. Ignoré si `prompt` est fourni. */
  q?: string;
  /** Texte libre du pro : renvoie les meilleures prestations correspondantes. */
  prompt?: string;
  limit?: number;
  domains?: string[];
  categoryIds?: string[];
};

/**
 * Autosuggestion. Passer le `signal` d'un AbortController à chaque frappe pour
 * annuler la requête précédente — sinon les réponses arrivent dans le désordre
 * et la liste clignote.
 */
export function suggestProLeaves(params: ProSuggestParams, signal?: AbortSignal) {
  const qs = new URLSearchParams();
  if (params.prompt) qs.set("prompt", params.prompt);
  else qs.set("q", params.q ?? "");
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.domains?.length) qs.set("domains", params.domains.join(","));
  if (params.categoryIds?.length) qs.set("categories", params.categoryIds.join(","));
  return get<ProSuggestResponse>(`${BASE}/suggest?${qs}`, signal);
}

/**
 * Profil d'intention — à qui l'on parle, déduit de ce qu'il fait.
 *
 * La publicité de Deal&Co ne doit pas ressembler à un panneau au bord de la
 * route. Proposer un installateur de caméras à quelqu'un qui compare des
 * voitures n'est pas seulement inefficace : ça décrédibilise l'emplacement, et
 * l'annonceur paie une impression qui n'avait aucune chance.
 *
 * Le profil ne crée **aucune collecte nouvelle**. Il assemble ce que le site
 * enregistre déjà pour d'autres raisons, par ordre de force du signal :
 *
 *   contexte      La page regardée maintenant. Le signal le plus sûr, et le
 *                 seul disponible pour un visiteur anonyme de passage.
 *   intérêts      `UserCategoryInterest`, calculé par le moteur de
 *                 recommandation à partir des publications, alertes, favoris
 *                 et consultations. Déjà là, déjà entretenu.
 *   navigation    Les catégories récemment parcourues, tenues dans le
 *                 navigateur (`lib/search-history`). Anonyme, locales, 30 jours.
 *   arrivée       Les mots-clés de la visite entrante, quand ils existent.
 *
 * Sur ce dernier point, une mise au point s'impose, parce que la promesse
 * courante est fausse : **on ne peut pas lire ce que quelqu'un a cherché sur
 * Google**. Les moteurs suppriment la requête du référent depuis 2011. Ce qui
 * reste réellement récupérable, c'est le `utm_term` d'un lien sponsorisé et la
 * requête portée par l'URL d'arrivée. Le reste demanderait un traceur tiers,
 * qu'on n'installera pas.
 *
 * Le profil est une pondération, pas un filtre : une campagne hors sujet est
 * dépriorisée, elle n'est pas interdite. Avec trois annonceurs, un filtre strict
 * viderait l'inventaire — ce que demande la régie aujourd'hui, c'est de savoir
 * classer, pour que le jour où il y en a cinquante, le classement existe déjà.
 */
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { categoryIdFromListing } from "@/lib/recommendations/category-interest";

const VALID = new Set(CATEGORIES.map((c) => c.id));

export type IntentProfile = {
  /** categoryId → poids 0…1. Vide = aucune intention connue. */
  weights: Map<string, number>;
  /** D'où viennent les signaux, pour l'écran de diagnostic. */
  sources: string[];
};

export const EMPTY_PROFILE: IntentProfile = { weights: new Map(), sources: [] };

/** Ajoute un signal sans jamais écraser un signal plus fort déjà présent. */
function reinforce(weights: Map<string, number>, categoryId: string | null, weight: number): boolean {
  if (!categoryId || !VALID.has(categoryId) || weight <= 0) return false;
  const current = weights.get(categoryId) ?? 0;
  // Deux signaux moyens valent mieux qu'un seul : on additionne en saturant,
  // plutôt que de garder le maximum. Quelqu'un qui consulte *et* met en favori
  // la même catégorie est plus sûrement intéressé que celui qui fait l'un des
  // deux.
  weights.set(categoryId, Math.min(1, current + weight * (1 - current)));
  return true;
}

/**
 * Mots-clés d'arrivée → catégorie, via le moteur de classification du site.
 *
 * Le même moteur qui range « MacBook Pro 2019 » dans Multimédia range la
 * requête « macbook pro occasion ». Aucun dictionnaire publicitaire à
 * entretenir en parallèle : deux dictionnaires finissent toujours par diverger.
 */
export async function categoriesFromKeywords(
  keywords: string[],
): Promise<{ categoryId: string; confidence: number }[]> {
  const usable = keywords.slice(0, 5).filter((k) => k.trim().length >= 3);
  if (usable.length === 0) return [];

  // Chargement à la demande : le moteur embarque un index de plus de 500 Ko,
  // et la très grande majorité des visites n'apporte aucun mot-clé. Le faire
  // venir à chaque publicité servie coûterait pour rien.
  const { classifyTitle } = await import("@/lib/category/engine");

  const out: { categoryId: string; confidence: number }[] = [];
  for (const raw of usable) {
    const text = raw.trim();
    const result = classifyTitle(text);
    if (result.categoryId && result.confidence >= 0.35) {
      out.push({ categoryId: result.categoryId, confidence: result.confidence });
    }
  }
  return out;
}

export type IntentInput = {
  /** Compte connecté, s'il y en a un. */
  userId?: string | null;
  /** Catégorie de la page regardée : libellé ou identifiant, les deux passent. */
  contextCategory?: string | null;
  /** Catégories récemment parcourues, du plus récent au plus ancien. */
  recentCategories?: string[];
  /** Mots-clés portés par l'URL d'arrivée (`utm_term`, `q`…). */
  landingKeywords?: string[];
};

/**
 * Assemble le profil. Une seule requête base au plus, et seulement pour un
 * compte connecté : une publicité ne justifie pas trois allers-retours.
 */
export async function buildIntentProfile(input: IntentInput): Promise<IntentProfile> {
  const weights = new Map<string, number>();
  const sources: string[] = [];

  if (reinforce(weights, categoryIdFromListing(input.contextCategory), 1)) sources.push("contexte");

  // Navigation récente : le rang porte la fraîcheur, `lib/search-history` ayant
  // déjà trié par récence pondérée côté navigateur.
  const recent = input.recentCategories ?? [];
  const RANK_WEIGHTS = [0.7, 0.5, 0.35];
  let usedRecent = false;
  recent.slice(0, 3).forEach((label, i) => {
    if (reinforce(weights, categoryIdFromListing(label), RANK_WEIGHTS[i] ?? 0.3)) usedRecent = true;
  });
  if (usedRecent) sources.push("navigation");

  for (const hit of await categoriesFromKeywords(input.landingKeywords ?? [])) {
    // Une requête d'arrivée est une intention écrite : forte, mais pondérée par
    // la confiance du classement, sinon un mot ambigu vaudrait une certitude.
    if (reinforce(weights, hit.categoryId, 0.8 * hit.confidence)) {
      if (!sources.includes("arrivée")) sources.push("arrivée");
    }
  }

  if (input.userId) {
    const interests = await prisma.userCategoryInterest
      .findMany({
        where: { userId: input.userId, score: { gte: 20 } },
        orderBy: { score: "desc" },
        take: 5,
        select: { categoryId: true, score: true },
      })
      .catch(() => []);
    let used = false;
    for (const row of interests) {
      if (reinforce(weights, row.categoryId, (row.score / 100) * 0.9)) used = true;
    }
    if (used) sources.push("intérêts");
  }

  return { weights, sources };
}

/**
 * Affinité d'une campagne avec le profil, entre 0 et 1.
 *
 * Une campagne sans ciblage catégoriel n'est pas pénalisée à zéro : elle
 * s'adresse à tout le monde, donc elle vaut une pertinence moyenne. La punir
 * reviendrait à forcer un ciblage à des annonceurs qui n'en veulent pas, et à
 * vider les emplacements généralistes.
 */
export function affinity(campaignCategories: string[], profile: IntentProfile): number {
  if (profile.weights.size === 0) return 0.5;
  if (campaignCategories.length === 0) return 0.4;

  let best = 0;
  for (const raw of campaignCategories) {
    const id = categoryIdFromListing(raw) ?? raw;
    best = Math.max(best, profile.weights.get(id) ?? 0);
  }
  return best;
}

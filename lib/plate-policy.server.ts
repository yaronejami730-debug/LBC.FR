/**
 * Décision de détection de plaques, côté serveur.
 *
 * Prolonge `lib/plate-policy.ts` d'un repli par le titre : quand aucune
 * rubrique n'est encore choisie, « BMW Série 3 » suffit à savoir qu'on est sur
 * une voiture avant même que l'annonceur ait touché au sélecteur.
 *
 * Séparé du module léger parce qu'il tire le moteur de catégorisation et sa
 * taxonomie — inutile de les embarquer dans le bundle du formulaire, qui
 * connaît déjà sa rubrique.
 */

import { classifyTitle } from "@/lib/category/engine";
import {
  categoryCarriesPlates,
  platePolicyFromCategory,
  type PlateDecision,
} from "@/lib/plate-policy";

export type PlatePolicyInput = {
  /** Identifiant ou libellé de rubrique, tel que connu du formulaire. */
  categoryId?: string | null;
  subcategory?: string | null;
  /** Titre en cours de saisie — sert quand aucune rubrique n'est choisie. */
  title?: string | null;
  description?: string | null;
};

/**
 * Faut-il analyser cette image ? Rend un booléen ferme et son motif.
 *
 * Fonction pure : ni réseau, ni base. Rejouable sur une annonce existante pour
 * comprendre pourquoi une plaque a été floutée, ou pourquoi elle ne l'a pas été.
 */
export function shouldDetectPlates(input: PlatePolicyInput): {
  shouldDetect: boolean;
  reason: string;
} {
  const fromCategory = platePolicyFromCategory(input.categoryId, input.subcategory);
  if (fromCategory.verdict !== "unknown") {
    return { shouldDetect: fromCategory.verdict === "detect", reason: fromCategory.reason };
  }

  const title = (input.title ?? "").trim();
  if (title.length < 3) {
    // Rien pour décider. Le doute penche vers l'analyse : voir `plate-policy.ts`.
    return { shouldDetect: true, reason: "aucun contexte — prudence" };
  }

  const guess: ReturnType<typeof classifyTitle> = classifyTitle(title, input.description ?? "");

  if (categoryCarriesPlates(guess.categoryId)) {
    return {
      shouldDetect: true,
      reason: `titre classé « ${guess.categoryId} » (${Math.round(guess.confidence * 100)} %)`,
    };
  }

  // Le moteur n'a pas su trancher : on ne se fie pas à un silence pour laisser
  // passer une plaque.
  if (guess.status === "unknown" || guess.status === "ambiguous") {
    return { shouldDetect: true, reason: `titre non classé (${guess.status}) — prudence` };
  }

  return { shouldDetect: false, reason: `titre classé « ${guess.categoryId} »` };
}

export type { PlateDecision };

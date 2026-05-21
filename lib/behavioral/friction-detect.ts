
/**
 * Détection de friction — pourquoi l'utilisateur ne publie pas.
 *
 * À partir des signaux observables (brouillon abandonné, allers-retours sur
 * /post sans soumission, compte sans annonce mais engagé), on identifie le
 * blocage dominant. L'objectif est de proposer la bonne action de
 * facilitation, pas de relancer aveuglément.
 *
 * Sortie déterministe, auditable, sans IA générative.
 */

export type FrictionInputs = {
  draftCompleteness: number;             // 0–100, 0 si aucun brouillon
  draftAgeHours: number | null;          // heures depuis updatedAt
  draftCategory: string | null;          // catégorie du brouillon
  postPageVisits7d: number;              // visites /post sans publier
  publishesLast30d: number;              // publications réussies
  ownListingsCount: number;              // annonces actives totales
  daysSinceSignup: number;
  favoritesCount: number;
  savedSearchesCount: number;
};

export type FrictionReason =
  | "draft_abandoned_high"     // brouillon très avancé, traîne
  | "draft_abandoned_low"      // brouillon entamé, bloqué bas
  | "post_page_loop"           // ouvre /post mais ne soumet jamais
  | "interested_non_publisher" // engagé acheteur, jamais publié
  | "stale_publisher"          // publiait avant, plus rien depuis 30+ j
  | "none";                    // aucune friction détectée

export type FrictionResult = {
  level: number;               // 0–100
  reason: FrictionReason;
  detail: Record<string, unknown>;
};

export function detectFriction(i: FrictionInputs): FrictionResult {
  // 1. Brouillon avancé et froid — le plus actionnable.
  if (
    i.draftCompleteness >= 60 &&
    i.draftAgeHours != null &&
    i.draftAgeHours >= 12
  ) {
    const level = Math.min(
      95,
      40 + Math.round(i.draftCompleteness * 0.4) + Math.min(15, i.draftAgeHours / 6),
    );
    return {
      level,
      reason: "draft_abandoned_high",
      detail: {
        completeness: i.draftCompleteness,
        ageHours: i.draftAgeHours,
        category: i.draftCategory,
      },
    };
  }

  // 2. Brouillon entamé mais bloqué bas (sous 60 %).
  if (
    i.draftCompleteness > 0 &&
    i.draftCompleteness < 60 &&
    i.draftAgeHours != null &&
    i.draftAgeHours >= 6
  ) {
    return {
      level: 55,
      reason: "draft_abandoned_low",
      detail: {
        completeness: i.draftCompleteness,
        ageHours: i.draftAgeHours,
        category: i.draftCategory,
      },
    };
  }

  // 3. Aller-retour sur /post sans publication.
  if (i.postPageVisits7d >= 3 && i.publishesLast30d === 0) {
    return {
      level: 50,
      reason: "post_page_loop",
      detail: { visits: i.postPageVisits7d },
    };
  }

  // 4. Acheteur engagé qui ne publie pas (compte ancien d'au moins une semaine).
  const engaged = i.favoritesCount + i.savedSearchesCount;
  if (
    i.ownListingsCount === 0 &&
    i.daysSinceSignup >= 7 &&
    engaged >= 3
  ) {
    return {
      level: 35,
      reason: "interested_non_publisher",
      detail: { daysSinceSignup: i.daysSinceSignup, engaged },
    };
  }

  // 5. Ancien publieur silencieux.
  if (i.ownListingsCount > 0 && i.publishesLast30d === 0 && i.daysSinceSignup >= 30) {
    return {
      level: 30,
      reason: "stale_publisher",
      detail: { ownListings: i.ownListingsCount },
    };
  }

  return { level: 0, reason: "none", detail: {} };
}

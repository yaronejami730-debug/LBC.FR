/**
 * Réglages du moteur de recommandation locale.
 *
 * Tout ce qui est un choix — un rayon, un seuil, une cadence — vit ici et
 * nulle part ailleurs. Le jour où « 20 km » devient « 15 km en Île-de-France et
 * 40 km en Lozère », il n'y a qu'un fichier à ouvrir, et l'écran
 * d'administration lit les mêmes valeurs que le CRON.
 */

export const RECO_CONFIG = {
  /** Rayon maximal entre une annonce et une zone de l'utilisateur. */
  radiusKm: 20,

  /**
   * Fenêtre de nouveauté. Une annonce plus ancienne n'est plus une
   * « nouvelle annonce » et ne doit pas être présentée comme telle.
   */
  freshnessDays: 7,

  /** En-deçà, la catégorie n'a pas assez bougé pour mériter un email. */
  minNewListingsPerCategory: 3,

  /** Score de pertinence minimal (0 → 100) pour qu'une annonce soit retenue. */
  minScore: 45,

  /**
   * Intérêt catégoriel minimal (0 → 100).
   *
   * C'est ce seuil qui empêche le scénario le plus tentant et le plus faux :
   * envoyer une maison à quelqu'un uniquement parce qu'il habite à côté. La
   * proximité seule ne vaut rien.
   */
  minCategoryInterest: 20,

  /** Confiance minimale d'une zone (0 → 100) pour servir de point de départ. */
  minZoneConfidence: 25,

  /** Nombre maximal d'annonces dans un email. Au-delà, personne ne lit. */
  maxListingsPerEmail: 12,

  /** En-deçà, on n'écrit pas : un email pour une annonce moyenne est du bruit. */
  minListingsPerEmail: 2,

  /** Une annonce déjà consultée n'est plus une découverte. */
  excludeAlreadyViewed: true,

  /** Délai minimal entre deux emails de recommandation, toutes catégories. */
  userThrottleDays: 3,

  /** Délai minimal entre deux emails de recommandation sur la même catégorie. */
  categoryThrottleDays: 7,

  /**
   * Historique de consultation pris en compte pour deviner une zone. Au-delà,
   * l'information dit où quelqu'un regardait, pas où il est.
   */
  viewHistoryDays: 90,

  /** Demi-vie de la confiance géographique, en jours. */
  locationHalfLifeDays: 180,

  /** Demi-vie de l'intérêt catégoriel, en jours. */
  interestHalfLifeDays: 90,

  /** Plancher du facteur de fraîcheur : une activité ancienne pèse peu, jamais rien. */
  recencyFloor: 0.3,

  /** Garde-fou mémoire : candidats retenus par commune d'annonce. */
  maxCandidatesPerZone: 3000,

  /** Nombre de comptes traités par exécution du CRON. */
  maxUsersPerRun: 2000,
} as const;

/** Type d'email utilisé pour le tracking et les préférences. */
export const RECO_EMAIL_TYPE = "listing_recommendation";

/**
 * Précisions géographiques acceptables pour décider à 20 km près.
 *
 * `DEPARTMENT` en est exclu : un département fait 70 km de large, statuer à
 * 20 km depuis son centroïde reviendrait à tirer à pile ou face en prétendant
 * calculer.
 */
export const USABLE_PRECISIONS = new Set(["COMMUNE", "POSTAL"]);

/** Facteur de décroissance temporelle, borné par `recencyFloor`. */
export function recencyFactor(lastActivityAt: Date, halfLifeDays: number, now = new Date()): number {
  const ageDays = Math.max(0, (now.getTime() - lastActivityAt.getTime()) / 86_400_000);
  const decayed = Math.pow(0.5, ageDays / halfLifeDays);
  return Math.max(RECO_CONFIG.recencyFloor, decayed);
}

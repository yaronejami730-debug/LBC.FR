/**
 * Score d'intention de publication — fonction pure, sans IA générative.
 *
 * Objectif : estimer la probabilité 0-100 qu'un utilisateur publie une
 * annonce dans les jours qui viennent. Combinaison de signaux observables.
 * Aucun signal n'est inventé — chaque entrée correspond à un compteur
 * réellement persisté (Draft, Favorite, SavedSearch, UserEvent, User…).
 *
 * Trois principes de design :
 *   1. Un brouillon en cours est le signal le plus fort de tous.
 *   2. La fraîcheur compte — un signal récent vaut plus qu'un signal vieux.
 *   3. Les bornes sont logistiques — un signal extrême ne peut pas exploser
 *      le score, plusieurs signaux moyens convergent vers une certitude.
 */

export type IntentInputs = {
  /** Complétude du brouillon courant (0–100). 0 si aucun brouillon. */
  draftCompleteness: number;
  /** Heures depuis la dernière mise à jour du brouillon. `null` si aucun. */
  draftAgeHours: number | null;
  /** Annonces actives de l'utilisateur. */
  ownListingsCount: number;
  /** Annonces ajoutées en favori les 30 derniers jours. */
  favoritesCount: number;
  /** Recherches sauvegardées actives. */
  savedSearchesCount: number;
  /** Vues d'annonces (UserEvent kind=listing_view) les 7 derniers jours. */
  listingViewsCount7d: number;
  /** Inscriptions waitlist (intention pré-publication). */
  waitlistEntries: number;
  /** Visites de la page /post les 7 derniers jours. */
  postPageVisits7d: number;
  /** Jours depuis l'inscription. */
  daysSinceSignup: number;
  /** Jours depuis la dernière connexion. */
  daysSinceLastLogin: number;
  /** Compte pro ? */
  isPro: boolean;
};

export type IntentLevel = "faible" | "moyen" | "fort" | "très fort";

export type IntentResult = {
  score: number;
  level: IntentLevel;
  topSignals: { signal: string; points: number }[];
};

/** Fenêtre de fraîcheur d'un brouillon — au-delà, on suppose qu'il a refroidi. */
const DRAFT_FRESH_HOURS = 24;
const DRAFT_STALE_HOURS = 72;

export function computeIntentScore(i: IntentInputs): IntentResult {
  const contribs: { signal: string; points: number }[] = [];

  // 1. Brouillon — signal le plus fort.
  if (i.draftCompleteness > 0) {
    const base = i.draftCompleteness * 0.6; // 0-60 pts
    const freshness =
      i.draftAgeHours == null
        ? 0
        : i.draftAgeHours <= DRAFT_FRESH_HOURS
          ? 10
          : i.draftAgeHours <= DRAFT_STALE_HOURS
            ? 4
            : -4;
    contribs.push({ signal: "draft_in_progress", points: Math.round(base) });
    if (freshness !== 0) contribs.push({ signal: "draft_freshness", points: freshness });
  }

  // 2. Visites répétées du formulaire — l'utilisateur tourne autour.
  if (i.postPageVisits7d >= 3) {
    contribs.push({ signal: "post_page_revisits", points: 18 });
  } else if (i.postPageVisits7d >= 1) {
    contribs.push({ signal: "post_page_visit", points: 8 });
  }

  // 3. Non-publieur intéressé : compte ancien, 0 annonce, mais engagé.
  const engaged =
    i.favoritesCount + i.savedSearchesCount + Math.min(5, i.listingViewsCount7d);
  if (i.ownListingsCount === 0 && i.daysSinceSignup >= 1 && engaged >= 3) {
    contribs.push({ signal: "interested_non_publisher", points: 15 });
  }

  // 4. Profil pro — la publication est leur usage normal.
  if (i.isPro) contribs.push({ signal: "pro_account", points: 10 });

  // 5. Activité récente.
  if (i.daysSinceLastLogin <= 1) contribs.push({ signal: "active_today", points: 8 });
  else if (i.daysSinceLastLogin <= 7) contribs.push({ signal: "active_week", points: 4 });
  else if (i.daysSinceLastLogin > 30) contribs.push({ signal: "dormant", points: -10 });

  // 6. Waitlist — intention exprimée explicitement.
  if (i.waitlistEntries > 0) {
    contribs.push({ signal: "waitlist_entry", points: Math.min(12, i.waitlistEntries * 6) });
  }

  // 7. Engagement buyer fort — peut basculer vendeur.
  if (i.listingViewsCount7d >= 15) {
    contribs.push({ signal: "high_listing_view_rate", points: 6 });
  }

  // Bornage logistique — empêche un seul signal extrême de saturer.
  const raw = contribs.reduce((s, c) => s + c.points, 0);
  const score = Math.round(100 / (1 + Math.exp(-(raw - 35) / 18)));

  const level: IntentLevel =
    score >= 75 ? "très fort" : score >= 50 ? "fort" : score >= 25 ? "moyen" : "faible";

  return {
    score,
    level,
    topSignals: [...contribs]
      .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
      .slice(0, 5),
  };
}

/**
 * Règles de vie d'un brouillon de dépôt.
 *
 * Une seule source pour les délais : le cron qui relance et purge, la page
 * « Mes brouillons » et les emails annoncent tous la même chose. Une date de
 * suppression affichée qui ne serait pas celle appliquée serait pire que pas
 * de date du tout.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

/** Durée de conservation d'un brouillon sans activité. */
export const DRAFT_KEEP_DAYS = 30;

/** Délai avant la 1re relance, à partir du dernier geste sur le formulaire. */
export const DRAFT_RELANCE_1_AFTER_MS = 90 * MINUTE_MS;

/** Délai avant la 2e et dernière relance, à partir de la première. */
export const DRAFT_RELANCE_2_AFTER_MS = 4 * HOUR_MS;

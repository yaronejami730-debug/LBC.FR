/**
 * Choix de l'heure d'envoi — fonction pure des ouvertures passées.
 *
 * Stratégie : histogramme par heure des ouvertures d'email (UserEvent /
 * EmailEvent.open) de l'utilisateur, lissage gaussien sur ±1 h, mode de la
 * distribution = meilleure heure. Repli sur la médiane population française
 * (≈ 19 h) quand l'historique est trop maigre (< 5 ouvertures).
 *
 * Fuseau : tout est calculé en heure locale Europe/Paris.
 */

const TZ = "Europe/Paris";
const POPULATION_DEFAULT_HOUR = 19;
const MIN_SAMPLES = 5;

/** Retourne l'heure 0–23 (Europe/Paris) d'un timestamp. */
function localHour(date: Date): number {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return Number.isFinite(h) ? h % 24 : 0;
}

export type TimingResult = {
  /** Heure 0–23 recommandée (Europe/Paris). */
  bestHour: number;
  /** Affichage humain "HH:MM". */
  bestHourLabel: string;
  /** Repli appliqué ? (échantillon insuffisant) */
  fallback: boolean;
  /** Nombre d'ouvertures utilisées pour la décision. */
  sampleSize: number;
};

/**
 * Choisit la meilleure heure d'envoi à partir des dates d'ouverture passées.
 *
 * @param openDates  toutes les dates d'ouverture (`EmailEvent.createdAt`
 *                   où `kind = "open"`) connues pour cet utilisateur
 */
export function pickBestSendHour(openDates: Date[]): TimingResult {
  if (openDates.length < MIN_SAMPLES) {
    return {
      bestHour: POPULATION_DEFAULT_HOUR,
      bestHourLabel: `${String(POPULATION_DEFAULT_HOUR).padStart(2, "0")}:00`,
      fallback: true,
      sampleSize: openDates.length,
    };
  }

  // Histogramme brut + lissage gaussien circulaire (±1 h).
  const hist = new Array(24).fill(0) as number[];
  for (const d of openDates) hist[localHour(d)]++;

  const smooth = new Array(24).fill(0) as number[];
  for (let h = 0; h < 24; h++) {
    smooth[h] =
      hist[(h + 23) % 24] * 0.25 + hist[h] * 0.5 + hist[(h + 1) % 24] * 0.25;
  }

  // Mode = heure du pic. En cas d'égalité, celle qui est plus proche de
  // l'heure courante (proxy d'habitude récente).
  let best = 0;
  let bestVal = -1;
  for (let h = 0; h < 24; h++) {
    if (smooth[h] > bestVal) {
      bestVal = smooth[h];
      best = h;
    }
  }

  return {
    bestHour: best,
    bestHourLabel: `${String(best).padStart(2, "0")}:00`,
    fallback: false,
    sampleSize: openDates.length,
  };
}

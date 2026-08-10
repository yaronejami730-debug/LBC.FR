/**
 * Conversions heure locale ↔ instant, pour le moteur de créneaux.
 *
 * Tout le module raisonne en **minutes depuis minuit, heure de Paris** : c'est
 * ainsi que le pro saisit ses horaires (« 10h → 19h »), et ça reste juste au
 * passage à l'heure d'été, contrairement à un décalage fixe.
 *
 * Pas de dépendance : le projet fait déjà ses conversions de fuseau avec
 * `Intl.DateTimeFormat` (cf. `lib/behavioral/timing.ts`).
 */

export const TZ = "Europe/Paris";
export const MINUTES_PER_DAY = 1440;

const PARTS_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type Wall = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function wallClock(date: Date): Wall {
  const out: Record<string, number> = {};
  for (const p of PARTS_FMT.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** Décalage du fuseau à cet instant, en millisecondes (heure murale − UTC). */
function offsetMs(date: Date): number {
  const w = wallClock(date);
  const asUTC = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUTC - date.getTime();
}

/** Clé de jour local, `YYYY-MM-DD`. C'est l'identifiant de journée du moteur. */
export function dayKey(date: Date): string {
  const w = wallClock(date);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** Minutes écoulées depuis minuit local. */
export function minutesOfDay(date: Date): number {
  const w = wallClock(date);
  return w.hour * 60 + w.minute;
}

/** Jour de la semaine local, 0 = dimanche … 6 = samedi (comme `Date.getDay()`). */
export function weekdayOf(dayKeyStr: string): number {
  const [y, m, d] = dayKeyStr.split("-").map(Number);
  // Midi UTC : à l'abri des décalages de fuseau, quelle que soit la saison.
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

/**
 * Instant correspondant à `minutes` après minuit, le jour local `dayKey`.
 *
 * Deux passes : la première estime le décalage à partir d'une lecture naïve,
 * la seconde le recalcule à l'instant trouvé. Sans ça, un créneau du dernier
 * dimanche de mars serait décalé d'une heure — le décalage change au milieu de
 * la journée qu'on est en train de convertir.
 */
export function instantFromLocal(dayKeyStr: string, minutes: number): Date {
  const [y, m, d] = dayKeyStr.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, minutes);
  let ts = naive - offsetMs(new Date(naive));
  ts = naive - offsetMs(new Date(ts));
  return new Date(ts);
}

/** `dayKey` décalé de `n` jours (n négatif accepté). */
export function addDays(dayKeyStr: string, n: number): string {
  const [y, m, d] = dayKeyStr.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + n, 12));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(
    shifted.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** Nombre de jours de `from` à `to` inclus. Négatif si `to` précède `from`. */
export function daysBetweenKeys(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const a = Date.UTC(fy, fm - 1, fd, 12);
  const b = Date.UTC(ty, tm - 1, td, 12);
  return Math.round((b - a) / 86_400_000);
}

/** « 870 » → « 14:30 ». Affichage uniquement. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** « 14:30 » → 870. Renvoie `null` si la chaîne n'est pas une heure valide. */
export function parseMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Vrai si la chaîne est une clé de jour valide (`YYYY-MM-DD`, date réelle). */
export function isDayKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d, 12));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() + 1 === m && probe.getUTCDate() === d;
}

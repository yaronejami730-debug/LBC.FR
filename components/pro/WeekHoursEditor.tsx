"use client";

import { Toggle } from "@/components/ui/Toggle";

/**
 * Éditeur d'horaires hebdomadaires — une seule grille pour toute la plateforme.
 *
 * Les horaires d'ouverture de la boutique et les horaires d'un membre de
 * l'équipe posent la même question à l'utilisateur : « qui travaille quand,
 * dans la semaine ». Ils étaient pourtant saisis de deux façons opposées — une
 * ligne par jour d'un côté, une liste vide où l'on choisissait le jour dans un
 * menu déroulant de l'autre. Le professionnel devait réapprendre le geste en
 * changeant de page, et la seconde forme laissait créer deux lignes « mardi »
 * contradictoires sans rien signaler.
 *
 * La grille est donc fixe : sept jours, toujours affichés, chacun ouvert ou
 * fermé. Le jour est la clé, pas une valeur à saisir.
 */

/** 0 = dimanche, comme `Date.getDay()` et comme la colonne `weekday` en base. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Une plage « HH:MM » → « HH:MM ». */
export type DayRange = { start: string; end: string };

/** Plages par jour. Tableau vide = fermé ce jour-là. */
export type WeekHours = Record<Weekday, DayRange[]>;

/** Lundi en premier : l'ordre d'une semaine de travail, pas celui du tableau. */
export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  0: "Dimanche",
};

export const DEFAULT_RANGE: DayRange = { start: "09:00", end: "19:00" };
const DEFAULT_SPLIT: DayRange = { start: "14:00", end: "19:00" };

export const EMPTY_WEEK: WeekHours = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

const input =
  "bg-surface-container-low rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 border border-transparent focus:border-primary/30";

export default function WeekHoursEditor({
  value,
  onChange,
  maxRangesPerDay = 2,
  closedLabel = "Fermé",
  addRangeLabel = "+ Coupure",
}: {
  value: WeekHours;
  onChange: (next: WeekHours) => void;
  /** 2 pour une vitrine (matin + après-midi) ; plus pour un planning découpé. */
  maxRangesPerDay?: number;
  closedLabel?: string;
  addRangeLabel?: string;
}) {
  const setDay = (day: Weekday, ranges: DayRange[]) => onChange({ ...value, [day]: ranges });

  const patchRange = (day: Weekday, index: number, patch: Partial<DayRange>) =>
    setDay(
      day,
      value[day].map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );

  /**
   * Recopie un jour sur tous les autres jours **déjà ouverts**.
   *
   * Ouvrir les sept jours au passage serait le contraire du service rendu :
   * la saisie fréquente est « même horaire du mardi au samedi », pas « ouvert
   * tous les jours ».
   */
  function applyToAll(source: Weekday) {
    const model = value[source];
    onChange(
      Object.fromEntries(
        WEEK_ORDER.map((d) => [d, value[d].length > 0 ? model.map((r) => ({ ...r })) : value[d]]),
      ) as WeekHours,
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {WEEK_ORDER.map((day) => {
        const ranges = value[day];
        const open = ranges.length > 0;

        return (
          <li key={day} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2.5 w-40 shrink-0">
                <Toggle
                  size="sm"
                  checked={open}
                  onChange={(next) => setDay(day, next ? [{ ...DEFAULT_RANGE }] : [])}
                  label={`${WEEKDAY_LABELS[day]} — ${open ? "ouvert" : "fermé"}`}
                />
                <span className="text-sm font-bold">{WEEKDAY_LABELS[day]}</span>
              </div>

              {open ? (
                <div className="flex flex-wrap items-center gap-2">
                  {ranges.map((range, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={range.start}
                        onChange={(e) => patchRange(day, i, { start: e.target.value })}
                        className={`${input} w-28`}
                        aria-label={`Début plage ${i + 1} ${WEEKDAY_LABELS[day]}`}
                      />
                      <span className="text-outline text-sm">→</span>
                      <input
                        type="time"
                        value={range.end}
                        onChange={(e) => patchRange(day, i, { end: e.target.value })}
                        className={`${input} w-28`}
                        aria-label={`Fin plage ${i + 1} ${WEEKDAY_LABELS[day]}`}
                      />
                      {/* La première plage ne se supprime pas : un jour ouvert
                          sans plage n'a pas de sens, on le referme. */}
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => setDay(day, ranges.filter((_, x) => x !== i))}
                          title="Supprimer cette plage"
                          className="text-outline hover:text-rose-600"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      )}
                    </div>
                  ))}

                  {ranges.length < maxRangesPerDay && (
                    <button
                      type="button"
                      onClick={() => setDay(day, [...ranges, { ...DEFAULT_SPLIT }])}
                      title="Ajouter une plage ce jour-là"
                      className="text-xs font-bold text-primary"
                    >
                      {addRangeLabel}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => applyToAll(day)}
                    title="Appliquer cet horaire à tous les jours ouverts"
                    className="text-xs font-bold text-outline hover:text-primary"
                  >
                    Appliquer partout
                  </button>
                </div>
              ) : (
                <span className="text-sm text-outline">{closedLabel}</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* --- Conversions vers les deux formats stockés ---------------------------- */

const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

const toMin = (value: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Lignes `{ weekday, startMin, endMin }` (plannings d'équipe) → grille. */
export function weekFromRows(rows: { weekday: number; startMin: number; endMin: number }[]): WeekHours {
  const week: WeekHours = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const row of rows) {
    const day = row.weekday as Weekday;
    if (!week[day]) continue;
    week[day].push({ start: toHHMM(row.startMin), end: toHHMM(row.endMin) });
  }
  for (const day of WEEK_ORDER) {
    week[day].sort((a, b) => a.start.localeCompare(b.start));
  }
  return week;
}

/** Grille → lignes, dans l'ordre de la semaine. Les plages illisibles sautent. */
export function rowsFromWeek(week: WeekHours): { weekday: number; startMin: number; endMin: number }[] {
  const rows: { weekday: number; startMin: number; endMin: number }[] = [];
  for (const day of WEEK_ORDER) {
    for (const range of week[day]) {
      const startMin = toMin(range.start);
      const endMin = toMin(range.end);
      if (startMin === null || endMin === null) continue;
      rows.push({ weekday: day, startMin, endMin });
    }
  }
  return rows;
}

/** Texte de la fiche publique (`{ lundi: "09:00 - 12:30, 14:00 - 19:00" }`) → grille. */
export function weekFromText(hours: Record<string, string>): WeekHours {
  const week: WeekHours = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const day of WEEK_ORDER) {
    const raw = hours[TEXT_KEYS[day]] ?? "";
    if (!raw.trim()) continue;
    // Le champ a pu être rempli par un import : on relit les heures présentes
    // plutôt que d'exiger un format. Un texte sans heure lisible rouvre le jour
    // sur l'horaire par défaut, ce qui se corrige d'un coup d'œil — le vider en
    // silence, non.
    const times = (raw.match(/(\d{1,2}):(\d{2})/g) ?? []).map((t) => (t.length === 4 ? `0${t}` : t));
    if (times.length === 0) {
      week[day] = [{ ...DEFAULT_RANGE }];
      continue;
    }
    for (let i = 0; i + 1 < times.length; i += 2) {
      week[day].push({ start: times[i], end: times[i + 1] });
    }
    if (week[day].length === 0) week[day] = [{ ...DEFAULT_RANGE }];
  }
  return week;
}

/** Grille → texte de la fiche publique. Jour fermé = chaîne vide. */
export function textFromWeek(week: WeekHours): Record<string, string> {
  return Object.fromEntries(
    WEEK_ORDER.map((day) => [
      TEXT_KEYS[day],
      week[day].map((r) => `${r.start} - ${r.end}`).join(", "),
    ]),
  );
}

/** Clés du champ `hours` en base — des noms français, en minuscules. */
const TEXT_KEYS: Record<Weekday, string> = {
  1: "lundi",
  2: "mardi",
  3: "mercredi",
  4: "jeudi",
  5: "vendredi",
  6: "samedi",
  0: "dimanche",
};

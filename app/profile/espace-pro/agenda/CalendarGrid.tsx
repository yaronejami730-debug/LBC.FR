"use client";

import { useMemo, useRef } from "react";

export type GridBooking = {
  id: string;
  status: string;
  day: string;
  time: string;
  label: string;
  durationMin: number;
  price: number;
  member: { id: string; displayName: string; color: string } | null;
  customer: { firstName: string; lastName: string; phone: string; email: string };
};

/** Hauteur d'une heure, en pixels. 56 px ≈ un rendez-vous de 30 min lisible. */
const HOUR_PX = 56;
const PX_PER_MIN = HOUR_PX / 60;

/**
 * Grille horaire de l'agenda — la vue « vrai calendrier ».
 *
 * La liste chronologique disait *quels* rendez-vous existent ; elle ne disait
 * pas où sont les trous. Un professionnel qui a un client au téléphone cherche
 * un blanc dans sa journée, pas la ligne suivante : il faut donc que le temps
 * vide occupe de la place à l'écran, proportionnellement à sa durée.
 *
 * Les rendez-vous qui se chevauchent — deux praticiens en parallèle — se
 * partagent la largeur du jour plutôt que de se recouvrir : un rendez-vous
 * caché derrière un autre est un rendez-vous oublié.
 */
export default function CalendarGrid({
  days,
  bookings,
  today,
  onPick,
  onOpen,
}: {
  days: string[];
  bookings: GridBooking[];
  /** Clé du jour courant, pour le trait « maintenant ». */
  today: string;
  /** Clic sur une zone vide : jour + minute arrondie au quart d'heure. */
  onPick: (day: string, startMin: number) => void;
  onOpen: (id: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  /**
   * Bornes de la grille.
   *
   * Afficher 00h–24h pour un salon ouvert de 9h à 19h passerait la moitié de
   * l'écran sur des heures où il ne se passe rien. On part donc des horaires
   * réels, élargis d'une heure de marge, avec un repli 8h–20h quand la journée
   * est vide.
   */
  const [startHour, endHour] = useMemo(() => {
    if (bookings.length === 0) return [8, 20];
    let min = 24 * 60;
    let max = 0;
    for (const b of bookings) {
      const s = toMin(b.time);
      min = Math.min(min, s);
      max = Math.max(max, s + b.durationMin);
    }
    return [Math.max(0, Math.floor(min / 60) - 1), Math.min(24, Math.ceil(max / 60) + 1)];
  }, [bookings]);

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour],
  );
  const gridHeight = (endHour - startHour) * HOUR_PX;

  /** Rendez-vous d'un jour, placés en colonnes pour ne pas se recouvrir. */
  const laidOut = useMemo(() => {
    const byDay = new Map<string, (GridBooking & { col: number; cols: number })[]>();

    for (const day of days) {
      const rows = bookings
        .filter((b) => b.day === day)
        .sort((a, b) => toMin(a.time) - toMin(b.time) || b.durationMin - a.durationMin);

      // Un « groupe » est une grappe de rendez-vous qui se touchent. La largeur
      // se divise à l'intérieur du groupe seulement : deux rendez-vous à des
      // heures distinctes gardent chacun toute la largeur.
      const placed: (GridBooking & { col: number; cols: number })[] = [];
      let group: (GridBooking & { col: number; cols: number })[] = [];
      let groupEnd = -1;

      const flush = () => {
        const cols = group.reduce((m, g) => Math.max(m, g.col + 1), 0);
        for (const g of group) g.cols = cols;
        placed.push(...group);
        group = [];
        groupEnd = -1;
      };

      for (const b of rows) {
        const start = toMin(b.time);
        const end = start + b.durationMin;
        if (start >= groupEnd && group.length > 0) flush();

        // Première colonne libre à cet instant.
        const taken = new Set(
          group.filter((g) => toMin(g.time) + g.durationMin > start).map((g) => g.col),
        );
        let col = 0;
        while (taken.has(col)) col++;

        group.push({ ...b, col, cols: 1 });
        groupEnd = Math.max(groupEnd, end);
      }
      if (group.length > 0) flush();

      byDay.set(day, placed);
    }
    return byDay;
  }, [days, bookings]);

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const showNow = days.includes(today) && nowMin >= startHour * 60 && nowMin <= endHour * 60;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {/* En-tête des jours, figé au défilement horizontal du corps. */}
      <div className="flex border-b border-slate-100 bg-white">
        <div className="w-14 shrink-0" />
        {days.map((day) => (
          <div
            key={day}
            className={`flex-1 min-w-[7rem] px-2 py-2.5 text-center ${
              day === today ? "bg-primary/5" : ""
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-outline">
              {formatWeekday(day)}
            </p>
            <p
              className={`text-lg font-extrabold font-['Manrope'] leading-tight ${
                day === today ? "text-primary" : ""
              }`}
            >
              {Number(day.slice(8, 10))}
            </p>
          </div>
        ))}
      </div>

      <div ref={scroller} className="overflow-x-auto">
        <div className="flex" style={{ height: gridHeight }}>
          {/* Colonne des heures */}
          <div className="w-14 shrink-0 relative border-r border-slate-100">
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[11px] font-semibold text-outline"
                style={{ top: i * HOUR_PX }}
              >
                {i === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          {days.map((day) => (
            <div
              key={day}
              className={`relative flex-1 min-w-[7rem] border-r border-slate-100 last:border-r-0 ${
                day === today ? "bg-primary/[0.03]" : ""
              }`}
            >
              {/* Lignes d'heure + zone cliquable pour créer un rendez-vous */}
              {hours.map((h, i) => (
                <button
                  key={h}
                  type="button"
                  title={`Ajouter un rendez-vous à ${String(h).padStart(2, "0")}:00`}
                  onClick={(e) => {
                    // Minute cliquée dans l'heure, arrondie au quart d'heure :
                    // c'est le pas de saisie d'un agenda, et ça évite un
                    // rendez-vous à 14h07.
                    const box = e.currentTarget.getBoundingClientRect();
                    const within = ((e.clientY - box.top) / HOUR_PX) * 60;
                    const rounded = Math.round(within / 15) * 15;
                    onPick(day, h * 60 + Math.min(45, Math.max(0, rounded)));
                  }}
                  className="absolute left-0 right-0 border-t border-slate-100 hover:bg-primary/[0.06] transition-colors"
                  style={{ top: i * HOUR_PX, height: HOUR_PX }}
                />
              ))}

              {/* Trait « maintenant » */}
              {showNow && day === today && (
                <div
                  aria-hidden
                  className="absolute left-0 right-0 z-20 pointer-events-none"
                  style={{ top: (nowMin - startHour * 60) * PX_PER_MIN }}
                >
                  <div className="h-px bg-rose-500" />
                  <div className="w-2 h-2 -mt-[4.5px] -ml-1 rounded-full bg-rose-500" />
                </div>
              )}

              {(laidOut.get(day) ?? []).map((b) => {
                const start = toMin(b.time);
                const off = b.status === "CANCELLED" || b.status === "NO_SHOW";
                const color = b.member?.color ?? "#2f6fb8";
                const width = `calc(${100 / b.cols}% - 4px)`;

                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => !off && onOpen(b.id)}
                    title={`${b.time} · ${b.label} · ${b.customer.firstName} ${b.customer.lastName}`}
                    className={`absolute z-10 overflow-hidden rounded-lg px-1.5 py-1 text-left text-[11px] leading-tight transition-shadow ${
                      off ? "opacity-45 line-through" : "hover:shadow-md cursor-pointer"
                    }`}
                    style={{
                      top: (start - startHour * 60) * PX_PER_MIN,
                      height: Math.max(18, b.durationMin * PX_PER_MIN - 2),
                      left: `calc(${(100 / b.cols) * b.col}% + 2px)`,
                      width,
                      backgroundColor: `${color}1a`,
                      borderLeft: `3px solid ${color}`,
                    }}
                  >
                    <span className="block font-bold truncate">{b.time}</span>
                    <span className="block truncate">{b.label}</span>
                    <span className="block truncate text-outline">
                      {b.customer.firstName} {b.customer.lastName}
                    </span>
                    {b.status === "PENDING" && (
                      <span className="block font-bold text-amber-700">À confirmer</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const toMin = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};

function formatWeekday(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d, 12)))
    .replace(".", "");
}

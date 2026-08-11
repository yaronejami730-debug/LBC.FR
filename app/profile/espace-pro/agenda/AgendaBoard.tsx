"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NewBookingDialog, { type DialogService } from "./NewBookingDialog";
import BookingSheet from "./BookingSheet";
import CalendarGrid from "./CalendarGrid";

type AgendaBooking = {
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  day: string;
  time: string;
  label: string;
  durationMin: number;
  price: number;
  note: string | null;
  member: { id: string; displayName: string; color: string } | null;
  customer: { firstName: string; lastName: string; phone: string; email: string };
};

type Member = { id: string; displayName: string; color: string; role: string | null };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "À confirmer",
  CONFIRMED: "Confirmé",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
  NO_SHOW: "Absent",
};

const card = "bg-white rounded-2xl border border-slate-100 p-5";

/**
 * Agenda du salon — vues jour et semaine.
 *
 * Les rendez-vous annulés restent affichés, barrés : un agenda qui les efface
 * laisse un trou inexpliqué quand le client rappelle pour contester.
 */
export default function AgendaBoard({ initialDay }: { initialDay: string }) {
  const [anchor, setAnchor] = useState(initialDay);
  const [view, setView] = useState<"day" | "week">("week");
  /**
   * Grille horaire par défaut.
   *
   * C'est la question qu'on pose à un agenda : « quand suis-je libre ». La
   * liste reste disponible — elle répond mieux à « qui vient aujourd'hui »,
   * et elle porte les actions (annuler, prix, statut) sur une seule ligne.
   */
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [bookings, setBookings] = useState<AgendaBooking[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<DialogService[]>([]);
  /** Ouverture du formulaire d'ajout, éventuellement préremplie. */
  const [adding, setAdding] = useState<null | { day?: string; memberId?: string; time?: string }>(
    null,
  );
  /** Rendez-vous ouvert pour correction, déplacement ou annulation. */
  const [opened, setOpened] = useState<AgendaBooking | null>(null);

  const [from, to] = useMemo(() => {
    if (view === "day") return [anchor, anchor];
    const start = startOfWeek(anchor);
    return [start, shift(start, 6)];
  }, [anchor, view]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pro/agenda?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Agenda indisponible");
      setBookings(data.bookings);
      setMembers(data.members);
      setServices(data.services ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancel(id: string) {
    const reason = window.prompt("Motif d'annulation (facultatif)") ?? "";
    if (!window.confirm("Annuler ce rendez-vous ? Le créneau redeviendra réservable.")) return;
    const res = await fetch(`/api/booking/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", reason }),
    });
    if (res.ok) void load();
    else setError((await res.json()).error ?? "Annulation impossible");
  }

  const visible = bookings.filter((b) => memberFilter === "all" || b.member?.id === memberFilter);
  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i <= dayDiff(from, to); i++) out.push(shift(from, i));
    return out;
  }, [from, to]);

  const revenue = visible
    .filter((b) => b.status !== "CANCELLED" && b.status !== "NO_SHOW")
    .reduce((sum, b) => sum + b.price, 0);

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center gap-3`}>
        {/* Le geste principal de cet écran : une coiffeuse qui décroche doit
            le trouver sans chercher. */}
        <button
          type="button"
          onClick={() => setAdding({ day: view === "day" ? anchor : undefined })}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-[0_4px_12px_rgba(47,111,184,0.25)]"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Ajouter un rendez-vous
        </button>

        <div className="flex rounded-full bg-surface-container-low p-0.5">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold ${view === v ? "bg-primary text-white" : "text-outline"}`}
            >
              {v === "day" ? "Jour" : "Semaine"}
            </button>
          ))}
        </div>

        <div className="flex rounded-full bg-surface-container-low p-0.5">
          {(["grid", "list"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLayout(l)}
              title={l === "grid" ? "Vue calendrier" : "Vue liste"}
              className={`rounded-full px-3 py-1.5 grid place-items-center ${layout === l ? "bg-primary text-white" : "text-outline"}`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {l === "grid" ? "calendar_view_week" : "view_list"}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setAnchor(shift(anchor, view === "day" ? -1 : -7))} className="w-9 h-9 rounded-full bg-surface-container-low grid place-items-center" title="Précédent">
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <button type="button" onClick={() => setAnchor(initialDay)} className="rounded-full bg-surface-container-low px-4 py-2 text-xs font-bold">
            Aujourd&apos;hui
          </button>
          <button type="button" onClick={() => setAnchor(shift(anchor, view === "day" ? 1 : 7))} className="w-9 h-9 rounded-full bg-surface-container-low grid place-items-center" title="Suivant">
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>

        {members.length > 1 && (
          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            className="bg-surface-container-low rounded-xl px-3 py-2 text-sm outline-none"
          >
            <option value="all">Toute l&apos;équipe</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        )}

        <span className="ml-auto text-sm">
          <strong className="font-extrabold">{visible.filter((b) => b.status !== "CANCELLED").length}</strong>{" "}
          <span className="text-outline">rdv ·</span>{" "}
          <strong className="font-extrabold text-primary">{revenue.toLocaleString("fr-FR")} €</strong>
        </span>
      </div>

      {adding && (
        <NewBookingDialog
          services={services}
          members={members}
          defaults={adding}
          onClose={() => setAdding(null)}
          onCreated={load}
        />
      )}

      {opened && (
        <BookingSheet
          booking={opened}
          services={services}
          members={members}
          onClose={() => setOpened(null)}
          onChanged={load}
        />
      )}

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {loading && <div className={`${card} text-sm text-outline`}>Chargement de l&apos;agenda…</div>}

      {!loading && layout === "grid" && (
        <CalendarGrid
          days={days}
          bookings={visible}
          today={initialDay}
          onPick={(day, startMin) =>
            setAdding({
              day,
              memberId: memberFilter !== "all" ? memberFilter : undefined,
              time: `${String(Math.floor(startMin / 60)).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}`,
            })
          }
          onOpen={(id) => {
            const found = bookings.find((b) => b.id === id);
            if (found) setOpened(found);
          }}
        />
      )}

      {!loading &&
        layout === "list" &&
        days.map((day) => {
          const dayBookings = visible.filter((b) => b.day === day).sort((a, b) => a.time.localeCompare(b.time));
          return (
            <section key={day} className={card}>
              <h2 className="text-sm font-extrabold font-['Manrope'] capitalize mb-3">{formatDay(day)}</h2>
              {dayBookings.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setAdding({ day, memberId: memberFilter !== "all" ? memberFilter : undefined })}
                  className="w-full text-left text-sm text-outline hover:text-primary"
                >
                  Aucun rendez-vous — cliquez pour en ajouter un.
                </button>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {dayBookings.map((b) => {
                    const off = b.status === "CANCELLED" || b.status === "NO_SHOW";
                    return (
                      <li
                        key={b.id}
                        onClick={() => !off && setOpened(b)}
                        className={`flex items-start gap-3 py-3 ${off ? "opacity-50" : "cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg"}`}
                      >
                        <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: b.member?.color ?? "#94a3b8" }} aria-hidden />
                        <span className="font-extrabold text-sm w-14 shrink-0">{b.time}</span>
                        <span className="min-w-0 flex-1">
                          <span className={`font-bold text-sm block ${off ? "line-through" : ""}`}>
                            {b.label} · {b.durationMin} min
                          </span>
                          <span className="text-xs text-outline block">
                            {b.customer.firstName} {b.customer.lastName} · {b.customer.phone}
                            {b.member && ` · ${b.member.displayName}`}
                          </span>
                          {b.note && <span className="text-xs text-outline italic block mt-0.5">« {b.note} »</span>}
                        </span>
                        <span className="text-right shrink-0">
                          <span className="font-extrabold text-primary text-sm block">{b.price.toLocaleString("fr-FR")} €</span>
                          <span className="text-[10px] font-bold uppercase tracking-wide text-outline">{STATUS_LABEL[b.status] ?? b.status}</span>
                          {!off && (
                            <button type="button" onClick={() => cancel(b.id)} className="block mt-1 text-[11px] font-bold text-rose-600 hover:underline">
                              Annuler
                            </button>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
    </div>
  );
}

/* --- Dates en clés `YYYY-MM-DD` : le serveur raisonne en heure de Paris, on
 *     ne réintroduit pas le fuseau du navigateur ici.                      */

function shift(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days, 12)).toISOString().slice(0, 10);
}

function dayDiff(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** Lundi de la semaine contenant `key`. */
function startOfWeek(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const weekday = date.getUTCDay();
  return shift(key, weekday === 0 ? -6 : 1 - weekday);
}

function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

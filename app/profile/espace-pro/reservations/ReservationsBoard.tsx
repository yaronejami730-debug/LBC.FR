"use client";

import { useMemo, useState } from "react";

export type ProBookingRow = {
  id: string;
  status: string;
  source: string;
  startAt: string;
  endAt: string;
  label: string;
  price: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  note: string | null;
  memberName: string | null;
  memberColor: string | null;
  cancelReason: string | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "En attente", cls: "bg-amber-50 text-amber-800" },
  CONFIRMED: { label: "Confirmé", cls: "bg-emerald-50 text-emerald-700" },
  IN_PROGRESS: { label: "En cours", cls: "bg-primary/10 text-primary" },
  COMPLETED: { label: "Terminé", cls: "bg-surface-container-low text-on-surface-variant" },
  CANCELLED: { label: "Annulé", cls: "bg-rose-50 text-rose-700" },
  NO_SHOW: { label: "Absent", cls: "bg-rose-50 text-rose-700" },
};

const SOURCE: Record<string, string> = {
  ONLINE: "En ligne",
  PHONE: "Téléphone",
  MANUAL: "Sur place",
};

type Filter = "pending" | "upcoming" | "all";

export default function ReservationsBoard({ initial }: { initial: ProBookingRow[] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<Filter>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const pendingCount = rows.filter((r) => r.status === "PENDING").length;

  const shown = useMemo(() => {
    const now = Date.now();
    if (filter === "pending") return rows.filter((r) => r.status === "PENDING");
    if (filter === "upcoming") {
      return rows.filter(
        (r) => new Date(r.startAt).getTime() >= now && r.status !== "CANCELLED" && r.status !== "NO_SHOW",
      );
    }
    return rows;
  }, [rows, filter]);

  /**
   * Accepter ou refuser.
   *
   * On ne retire pas la ligne après coup : le professionnel vient de décider,
   * il doit voir le résultat de sa décision là où il l'a prise. Elle sortira
   * de l'onglet « En attente » au prochain changement de filtre.
   */
  async function decide(id: string, action: "confirm" | "refuse") {
    if (action === "refuse" && !window.confirm("Refuser cette demande ? Le créneau sera libéré.")) {
      return;
    }
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/booking/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Action impossible" });
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: data.booking.status } : r)),
      );
      setMessage({
        ok: true,
        text: action === "confirm" ? "Réservation confirmée." : "Demande refusée, créneau libéré.",
      });
    } catch {
      setMessage({ ok: false, text: "Erreur réseau, réessayez." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            message.ok
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
              : "bg-rose-50 text-rose-700 border border-rose-100"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["pending", `En attente${pendingCount > 0 ? ` (${pendingCount})` : ""}`],
            ["upcoming", "À venir"],
            ["all", "Tout"],
          ] as [Filter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              filter === id
                ? "bg-primary text-white"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-outline">
          {filter === "pending"
            ? "Aucune demande en attente."
            : filter === "upcoming"
              ? "Aucune réservation à venir."
              : "Aucune réservation."}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((row) => {
            const status = STATUS[row.status] ?? { label: row.status, cls: "bg-slate-100" };
            const start = new Date(row.startAt);
            const end = new Date(row.endAt);

            return (
              <li key={row.id} className="rounded-2xl border border-slate-100 bg-white p-5">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status.cls}`}>
                        {status.label}
                      </span>
                      <span className="text-[11px] font-semibold text-outline">
                        {SOURCE[row.source] ?? row.source}
                      </span>
                    </div>

                    <p className="mt-2 font-extrabold font-['Manrope']">{row.label}</p>
                    <p className="text-sm text-on-surface-variant">
                      {start.toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })} →{" "}
                      {end.toLocaleTimeString("fr-FR", { timeStyle: "short" })}
                    </p>

                    <p className="mt-1.5 text-sm">
                      <span className="font-semibold">
                        {row.firstName} {row.lastName}
                      </span>{" "}
                      · <a href={`tel:${row.phone}`} className="text-primary hover:underline">{row.phone}</a>
                    </p>

                    {row.memberName && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-outline">
                        <span
                          aria-hidden
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: row.memberColor ?? "#94a3b8" }}
                        />
                        Avec {row.memberName}
                      </p>
                    )}

                    {row.note && <p className="mt-1.5 text-xs text-outline italic">« {row.note} »</p>}
                    {row.cancelReason && (
                      <p className="mt-1.5 text-xs text-rose-700">{row.cancelReason}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-extrabold">{row.price.toFixed(2)} €</p>
                  </div>
                </div>

                {/* Accepter / refuser : seulement tant que la demande est en
                    attente. Un rendez-vous accepté s'annule depuis l'agenda,
                    avec le motif — ce n'est pas la même décision. */}
                {row.status === "PENDING" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => decide(row.id, "confirm")}
                      disabled={busyId === row.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">check</span>
                      Accepter
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(row.id, "refuse")}
                      disabled={busyId === row.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-on-surface-variant hover:border-rose-300 hover:text-rose-700 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                      Refuser
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

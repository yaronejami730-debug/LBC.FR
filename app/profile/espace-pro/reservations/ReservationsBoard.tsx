"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toggle } from "@/components/ui/Toggle";

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

/** Rythme du sondage : assez court pour qu'une demande « apparaisse », assez
    long pour ne pas marteler la base quand l'onglet reste ouvert la journée. */
const POLL_MS = 10_000;

export default function ReservationsBoard({
  initial,
  serverNow,
  establishment,
  initialAutoConfirm,
}: {
  initial: ProBookingRow[];
  /** Horloge serveur au rendu, point de départ du sondage incrémental. */
  serverNow: string;
  establishment: { name: string; address: string | null };
  initialAutoConfirm: boolean;
}) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<Filter>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [autoConfirm, setAutoConfirm] = useState(initialAutoConfirm);
  const [savingAuto, setSavingAuto] = useState(false);
  const [live, setLive] = useState(true);
  const since = useRef(serverNow);

  /**
   * Fusionne ce que le serveur a modifié depuis le dernier passage.
   *
   * On remplace ligne à ligne au lieu de tout réécrire : le professionnel peut
   * être en train de lire une fiche pendant qu'une réservation arrive, et un
   * remplacement complet de la liste ferait sauter le défilement sous ses yeux.
   */
  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/pro/reservations?since=${encodeURIComponent(since.current)}`);
      if (!res.ok) {
        setLive(false);
        return;
      }
      const data = (await res.json()) as { now: string; bookings: ProBookingRow[] };
      since.current = data.now;
      setLive(true);
      if (data.bookings.length === 0) return;

      setRows((prev) => {
        const byId = new Map(prev.map((r) => [r.id, r]));
        for (const row of data.bookings) byId.set(row.id, row);
        return [...byId.values()].sort((a, b) => a.startAt.localeCompare(b.startAt));
      });
    } catch {
      setLive(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(poll, POLL_MS);
    // Revenir sur l'onglet doit rattraper immédiatement : attendre le prochain
    // tick donnerait dix secondes de liste périmée juste au moment où on
    // regarde.
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  async function toggleAutoConfirm(next: boolean) {
    setSavingAuto(true);
    setMessage(null);
    try {
      const res = await fetch("/api/pro/booking-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoConfirm: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Réglage impossible" });
        return;
      }
      setAutoConfirm(next);
      setMessage({
        ok: true,
        text: next
          ? "Auto-acceptation activée — les nouvelles réservations sont confirmées immédiatement."
          : "Auto-acceptation désactivée — chaque demande attendra votre réponse.",
      });
    } catch {
      setMessage({ ok: false, text: "Erreur réseau, réessayez." });
    } finally {
      setSavingAuto(false);
    }
  }

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

      {/* Quel établissement — un compte à deux salons doit savoir lequel il
          est en train de regarder avant d'accepter quoi que ce soit. */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5">
        <div className="flex flex-wrap items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-primary/10 grid place-items-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[18px]">storefront</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold font-['Manrope']">{establishment.name}</p>
            {establishment.address && (
              <p className="text-xs text-outline mt-0.5">{establishment.address}</p>
            )}
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
            }`}
            title={live ? "Les nouvelles réservations arrivent sans recharger" : "Reconnexion…"}
          >
            <span
              aria-hidden
              className={`w-1.5 h-1.5 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}
            />
            {live ? "En direct" : "Hors ligne"}
          </span>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-on-surface">Auto-acceptation</p>
            <p className="text-xs text-outline mt-0.5 leading-relaxed">
              {autoConfirm
                ? "Les réservations sont confirmées dès leur arrivée, le client reçoit sa confirmation immédiatement."
                : "Chaque demande attend votre accord. Le créneau reste bloqué en attendant votre réponse."}
            </p>
          </div>
          <Toggle
            checked={autoConfirm}
            onChange={toggleAutoConfirm}
            loading={savingAuto}
            tone="emerald"
            size="lg"
            label="Auto-acceptation des réservations"
          />
        </div>
      </div>

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

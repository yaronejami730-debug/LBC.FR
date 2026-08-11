"use client";

import { useEffect, useRef, useState } from "react";
import type { DialogMember, DialogService } from "./NewBookingDialog";

/**
 * Fiche d'un rendez-vous : corriger, déplacer, annuler.
 *
 * Trois gestes séparés parce qu'ils ne coûtent pas la même chose. Corriger un
 * numéro de téléphone ne touche pas au créneau ; le déplacer le libère et le
 * reprend ailleurs, avec tout ce que ça implique de vérifications. Les
 * confondre dans un seul formulaire ferait passer une faute de frappe par le
 * moteur de disponibilité — et exposerait le créneau le temps de l'opération.
 */

type Booking = {
  id: string;
  status: string;
  day: string;
  time: string;
  label: string;
  durationMin: number;
  member: { id: string; displayName: string } | null;
  customer: { firstName: string; lastName: string; phone: string; email: string };
  note: string | null;
};

type CheckResult = {
  available: boolean;
  reason: string | null;
  alternatives: { memberId: string; memberName: string; slots: string[] }[];
};

const ANY = "any";
const input =
  "w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none border border-slate-200 focus:border-primary/40 focus:ring-2 focus:ring-primary/20";
const lbl = "text-[10px] text-outline uppercase font-bold tracking-wider block mb-1";

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
}

export default function BookingSheet({
  booking,
  services,
  members,
  onClose,
  onChanged,
}: {
  booking: Booking;
  services: DialogService[];
  members: DialogMember[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<"edit" | "move">("edit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contact, setContact] = useState({
    firstName: booking.customer.firstName,
    lastName: booking.customer.lastName,
    phone: booking.customer.phone,
    email: booking.customer.email,
    note: booking.note ?? "",
  });

  const [serviceId, setServiceId] = useState(
    services.find((s) => s.label === booking.label)?.id ?? services[0]?.id ?? "",
  );
  const [memberId, setMemberId] = useState(booking.member?.id ?? ANY);
  const [day, setDay] = useState(booking.day);
  const [time, setTime] = useState(booking.time);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  const startMin = toMinutes(time);
  const unchangedSlot = day === booking.day && time === booking.time && memberId === (booking.member?.id ?? ANY);

  // Vérification du créneau d'arrivée, comme à la création — même moteur.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (tab !== "move" || !serviceId || startMin === null || unchangedSlot) {
      setCheck(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setChecking(true);
    timer.current = setTimeout(() => {
      const p = new URLSearchParams({ serviceId, day, startMin: String(startMin) });
      if (memberId !== ANY) p.set("memberId", memberId);
      fetch(`/api/booking/pro/check?${p}`)
        .then((r) => r.json())
        .then((d: CheckResult & { error?: string }) => setCheck(d.error ? null : d))
        .catch(() => setCheck(null))
        .finally(() => setChecking(false));
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [tab, serviceId, memberId, day, startMin, unchangedSlot]);

  async function send(body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/booking/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Opération impossible.");
        return;
      }
      onChanged();
      onClose();
    } catch {
      setError("Erreur réseau, réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-surface border-b border-slate-100 px-5 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="font-extrabold font-['Manrope'] truncate">
              {booking.customer.firstName} {booking.customer.lastName}
            </h2>
            <p className="text-xs text-outline truncate">
              {booking.label} · {booking.time} · {booking.durationMin} min
              {booking.member ? ` · ${booking.member.displayName}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-bold text-outline shrink-0 ml-3">
            Fermer
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex rounded-full bg-surface-container-low p-0.5">
            {([
              ["edit", "Corriger"],
              ["move", "Déplacer"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex-1 rounded-full px-4 py-2 text-xs font-bold ${
                  tab === key ? "bg-primary text-white" : "text-outline"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "edit" && (
            <section className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className={lbl}>Prénom</span>
                  <input className={input} value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} />
                </div>
                <div>
                  <span className={lbl}>Nom</span>
                  <input className={input} value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} />
                </div>
              </div>
              <div>
                <span className={lbl}>Téléphone</span>
                <input className={input} inputMode="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
              </div>
              <div>
                <span className={lbl}>Email</span>
                <input className={input} type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
              </div>
              <div>
                <span className={lbl}>Note</span>
                <textarea className={input + " resize-none"} rows={2} value={contact.note} onChange={(e) => setContact({ ...contact, note: e.target.value })} />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => send({ action: "edit", contact })}
                className="w-full rounded-full bg-primary py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                {busy ? "Enregistrement…" : "Enregistrer les corrections"}
              </button>
              <p className="text-[11px] text-outline text-center">Le créneau n&apos;est pas modifié.</p>
            </section>
          )}

          {tab === "move" && (
            <section className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
              <div>
                <span className={lbl}>Prestation</span>
                <select className={input} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} — {s.durationMin} min
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={lbl}>Avec</span>
                <div className="flex flex-wrap gap-2">
                  {[{ id: ANY, displayName: "Peu importe" }, ...members].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMemberId(m.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                        memberId === m.id ? "bg-primary text-white border-primary" : "bg-white border-slate-200 text-slate-600"
                      }`}
                    >
                      {m.displayName}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className={lbl}>Date</span>
                  <input className={input} type="date" value={day} onChange={(e) => setDay(e.target.value)} />
                </div>
                <div>
                  <span className={lbl}>Heure</span>
                  <input className={input} type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>

              {checking && <p className="text-sm text-outline">Vérification…</p>}

              {!checking && check && (
                <div className={`rounded-xl p-3 ${check.available ? "bg-emerald-50 border border-emerald-200" : "bg-[#fff8f7] border border-[#ffdad6]"}`}>
                  <p className={`text-sm font-extrabold ${check.available ? "text-emerald-700" : "text-[#ba1a1a]"}`}>
                    {check.available ? "🟢 Créneau libre" : "🔴 Impossible de déplacer ce rendez-vous"}
                  </p>
                  {check.reason && <p className="text-sm text-on-surface-variant mt-1">{check.reason}</p>}
                  {!check.available &&
                    check.alternatives.map((alt) => (
                      <div key={alt.memberId} className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-xs font-bold w-20 shrink-0">{alt.memberName}</span>
                        {alt.slots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              setMemberId(alt.memberId);
                              setTime(slot);
                            }}
                            className="rounded-full bg-white border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-700"
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    ))}
                </div>
              )}

              <button
                type="button"
                disabled={busy || unchangedSlot || !check?.available || startMin === null}
                onClick={() => send({ action: "reschedule", serviceId, memberId, day, startMin })}
                className="w-full rounded-full bg-primary py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                {busy ? "Déplacement…" : unchangedSlot ? "Choisissez un autre créneau" : "Déplacer le rendez-vous"}
              </button>
            </section>
          )}

          {error && <p className="text-sm font-semibold text-[#ba1a1a]">{error}</p>}

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              send(
                { action: "cancel" },
                `Voulez-vous vraiment annuler le rendez-vous de ${booking.customer.firstName} ${booking.customer.lastName} ?`,
              )
            }
            className="w-full rounded-full border border-[#ffdad6] bg-[#fff8f7] py-3 text-sm font-bold text-[#ba1a1a] disabled:opacity-40"
          >
            Annuler ce rendez-vous
          </button>
          <p className="text-[11px] text-outline text-center">
            Le créneau redevient immédiatement disponible.
          </p>
        </div>
      </div>
    </div>
  );
}

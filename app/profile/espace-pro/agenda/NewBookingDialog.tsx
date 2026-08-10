"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ajout d'un rendez-vous par le professionnel — le cas du téléphone.
 *
 * Contrainte de conception : la personne a un client en ligne. Elle doit
 * pouvoir répondre « oui, 10h30 » ou « non, mais 11h15 » en quelques secondes.
 * D'où l'ordre client → prestation → praticien → date → heure, et surtout la
 * vérification qui se déclenche seule dès que ces éléments sont réunis :
 * personne n'a le temps de cliquer sur « vérifier ».
 *
 * Aucune règle de disponibilité n'est calculée ici. Tout vient de
 * `/api/booking/pro/check`, qui interroge le même moteur que la réservation en
 * ligne — sans quoi le site et le dashboard finiraient par se contredire.
 */

export type DialogService = {
  id: string;
  label: string;
  section: string;
  durationMin: number;
  price: number;
};

export type DialogMember = { id: string; displayName: string; color: string };

type CheckResult = {
  available: boolean;
  reason: string | null;
  requestedMember: string | null;
  alternatives: { memberId: string; memberName: string; slots: string[] }[];
};

const ANY = "any";

const input =
  "w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none border border-slate-200 focus:border-primary/40 focus:ring-2 focus:ring-primary/20";
const label = "text-[10px] text-outline uppercase font-bold tracking-wider block mb-1";

/** `10:30` → minutes depuis minuit. */
function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export default function NewBookingDialog({
  services,
  members,
  defaults,
  onClose,
  onCreated,
}: {
  services: DialogService[];
  members: DialogMember[];
  /** Prérempli quand on clique un créneau vide de l'agenda. */
  defaults?: { day?: string; time?: string; memberId?: string };
  onClose: () => void;
  onCreated: () => void;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [memberId, setMemberId] = useState(defaults?.memberId ?? ANY);
  const [day, setDay] = useState(defaults?.day ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(defaults?.time ?? "10:00");

  const [contact, setContact] = useState({ firstName: "", lastName: "", phone: "", email: "", note: "" });
  const [known, setKnown] = useState<{ firstName: string; lastName: string; phone: string; email: string }[]>([]);

  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const startMin = toMinutes(time);

  // ── Client déjà venu ? ────────────────────────────────────────────
  //
  // Un salon rappelle rarement un inconnu. Retrouver la fiche évite de faire
  // épeler un nom deux fois, et surtout évite un doublon dans le carnet.
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    const digits = contact.phone.replace(/\D/g, "");
    if (digits.length < 6) {
      setKnown([]);
      return;
    }
    phoneTimer.current = setTimeout(() => {
      fetch(`/api/booking/pro/create?phone=${encodeURIComponent(digits)}`)
        .then((r) => r.json())
        .then((d: { customers?: typeof known }) => setKnown(d.customers ?? []))
        .catch(() => setKnown([]));
    }, 350);
    return () => {
      if (phoneTimer.current) clearTimeout(phoneTimer.current);
    };
  }, [contact.phone]);

  // ── Vérification automatique ──────────────────────────────────────
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!serviceId || !day || startMin === null) {
      setCheck(null);
      return;
    }
    setChecking(true);
    checkTimer.current = setTimeout(() => {
      const params = new URLSearchParams({ serviceId, day, startMin: String(startMin) });
      if (memberId !== ANY) params.set("memberId", memberId);
      fetch(`/api/booking/pro/check?${params}`)
        .then((r) => r.json())
        .then((d: CheckResult & { error?: string }) => setCheck(d.error ? null : d))
        .catch(() => setCheck(null))
        .finally(() => setChecking(false));
    }, 300);
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [serviceId, memberId, day, startMin]);

  async function submit() {
    if (startMin === null) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/booking/pro/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          memberId,
          day,
          startMin,
          source: "PHONE",
          contact: {
            firstName: contact.firstName.trim(),
            lastName: contact.lastName.trim(),
            phone: contact.phone.trim(),
            email: contact.email.trim(),
            note: contact.note.trim() || null,
          },
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Création impossible.");
        return;
      }
      onCreated();
      onClose();
    } catch {
      setError("Erreur réseau, réessayez.");
    } finally {
      setSaving(false);
    }
  }

  const ready =
    contact.firstName.trim() &&
    contact.lastName.trim() &&
    contact.phone.trim().length >= 8 &&
    serviceId &&
    startMin !== null &&
    check?.available;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-surface border-b border-slate-100 px-5 py-3 flex items-center justify-between">
          <h2 className="font-extrabold font-['Manrope']">Ajouter un rendez-vous</h2>
          <button type="button" onClick={onClose} className="text-sm font-bold text-outline">
            Fermer
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* ── Client ─────────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Client</p>
            <div>
              <span className={label}>Téléphone *</span>
              <input
                className={input}
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                placeholder="06 12 34 56 78"
                inputMode="tel"
              />
            </div>

            {known.length > 0 && (
              <div className="rounded-xl bg-[#f5f9ff] border border-primary/20 p-2">
                <p className="text-[11px] font-bold text-primary mb-1">Déjà venu :</p>
                {known.slice(0, 3).map((k) => (
                  <button
                    key={k.phone + k.firstName}
                    type="button"
                    onClick={() =>
                      setContact((c) => ({
                        ...c,
                        firstName: k.firstName,
                        lastName: k.lastName,
                        phone: k.phone,
                        email: k.email || c.email,
                      }))
                    }
                    className="block w-full text-left text-sm font-semibold py-1 hover:underline"
                  >
                    {k.firstName} {k.lastName} · {k.phone}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className={label}>Prénom *</span>
                <input
                  className={input}
                  value={contact.firstName}
                  onChange={(e) => setContact({ ...contact, firstName: e.target.value })}
                />
              </div>
              <div>
                <span className={label}>Nom *</span>
                <input
                  className={input}
                  value={contact.lastName}
                  onChange={(e) => setContact({ ...contact, lastName: e.target.value })}
                />
              </div>
            </div>
            <div>
              <span className={label}>Email (facultatif)</span>
              <input
                className={input}
                type="email"
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                placeholder="Pour lui envoyer la confirmation"
              />
            </div>
          </section>

          {/* ── Rendez-vous ────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Rendez-vous</p>
            <div>
              <span className={label}>Prestation *</span>
              <select className={input} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.section} · {s.label} — {s.durationMin} min · {s.price} €
                  </option>
                ))}
              </select>
              {/* La durée vient de la prestation, elle ne se saisit pas : c'est
                  elle qui détermine le créneau à bloquer. */}
              {service && (
                <p className="text-[11px] text-outline mt-1">Durée : {service.durationMin} minutes</p>
              )}
            </div>

            <div>
              <span className={label}>Avec</span>
              <div className="flex flex-wrap gap-2">
                {[{ id: ANY, displayName: "Peu importe", color: "#777683" }, ...members].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMemberId(m.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                      memberId === m.id
                        ? "bg-primary text-white border-primary"
                        : "bg-white border-slate-200 text-slate-600"
                    }`}
                  >
                    {m.displayName}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className={label}>Date *</span>
                <input className={input} type="date" value={day} onChange={(e) => setDay(e.target.value)} />
              </div>
              <div>
                <span className={label}>Heure *</span>
                <input className={input} type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
          </section>

          {/* ── Verdict ────────────────────────────────────────── */}
          {checking && <p className="text-sm text-outline">Vérification…</p>}

          {!checking && check && (
            <div
              className={`rounded-xl p-4 ${
                check.available ? "bg-emerald-50 border border-emerald-200" : "bg-[#fff8f7] border border-[#ffdad6]"
              }`}
            >
              <p className={`text-sm font-extrabold ${check.available ? "text-emerald-700" : "text-[#ba1a1a]"}`}>
                {check.available ? "🟢 Disponible" : "🔴 Indisponible"}
              </p>
              {check.reason && <p className="text-sm text-on-surface-variant mt-1">{check.reason}</p>}

              {!check.available && check.alternatives.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-outline">
                    Créneaux disponibles
                  </p>
                  {check.alternatives.map((alt) => (
                    <div key={alt.memberId} className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold w-20 shrink-0">{alt.memberName}</span>
                      {alt.slots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          // Un clic applique la proposition : au téléphone, on
                          // dit « 11h15 ? » et on valide dans la foulée.
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
            </div>
          )}

          {error && <p className="text-sm font-semibold text-[#ba1a1a]">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={!ready || saving}
            className="w-full rounded-full bg-primary py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? "Création…" : "Confirmer le rendez-vous"}
          </button>
          <p className="text-[11px] text-outline text-center">
            Le rendez-vous sera confirmé immédiatement — vous avez le client en ligne.
          </p>
        </div>
      </div>
    </div>
  );
}

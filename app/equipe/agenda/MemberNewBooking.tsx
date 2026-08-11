"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * « Le téléphone sonne, je note le rendez-vous. »
 *
 * Version membre du dialogue de l'espace pro, réduite à ce qu'une personne
 * seule au comptoir peut traiter en tenant un combiné : pas de choix de
 * praticien — c'est pour elle —, pas de sélection d'établissement, et la
 * vérification de disponibilité qui part toute seule dès que la prestation, le
 * jour et l'heure sont renseignés.
 *
 * Les créneaux libres affichés viennent du moteur de réservation, pas d'un
 * calcul local : le planning affiché ici et ce que voit un client sur la fiche
 * sont la même chose, sinon les deux finiraient par se contredire.
 */

type Service = {
  id: string;
  label: string;
  section: string;
  durationMin: number;
  price: number;
};

type Check = {
  available: boolean;
  reason: string | null;
  alternatives: string[];
  slots: { startMin: number; label: string }[];
};

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

export default function MemberNewBooking() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<Service[] | null>(null);

  const [serviceId, setServiceId] = useState("");
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [contact, setContact] = useState({ firstName: "", lastName: "", phone: "", note: "" });

  const [check, setCheck] = useState<Check | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startMin = toMinutes(time);
  const service = services?.find((s) => s.id === serviceId) ?? null;

  // Les prestations ne sont chargées qu'à l'ouverture : la plupart des visites
  // sur cet écran servent à consulter son planning, pas à saisir.
  useEffect(() => {
    if (!open || services) return;
    void (async () => {
      const res = await fetch("/api/equipe/booking");
      const data = (await res.json()) as { services?: Service[] };
      setServices(data.services ?? []);
      setServiceId(data.services?.[0]?.id ?? "");
    })();
  }, [open, services]);

  // Vérification automatique : personne n'a le temps de cliquer sur
  // « vérifier » avec un client en ligne. Court délai pour ne pas interroger le
  // moteur à chaque frappe dans le champ d'heure.
  useEffect(() => {
    if (!open || !serviceId || !day || startMin === null) {
      setCheck(null);
      return;
    }
    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const params = new URLSearchParams({ serviceId, day, startMin: String(startMin) });
        const res = await fetch(`/api/equipe/booking?${params}`);
        const data = (await res.json()) as Check & { error?: string };
        if (!res.ok) {
          setCheck(null);
          setError(data.error ?? null);
          return;
        }
        setError(null);
        setCheck(data);
      } finally {
        setChecking(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [open, serviceId, day, startMin]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (startMin === null) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/equipe/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          day,
          startMin,
          contact: {
            firstName: contact.firstName,
            lastName: contact.lastName,
            phone: contact.phone,
            // Au téléphone on ne demande pas toujours l'email : le moteur
            // l'accepte vide pour une saisie professionnelle.
            email: "",
            note: contact.note || null,
          },
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Enregistrement impossible");
        return;
      }
      setOpen(false);
      setContact({ firstName: "", lastName: "", phone: "", note: "" });
      setCheck(null);
      router.refresh();
    } catch {
      setError("Erreur réseau, réessayez");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ajouter un rendez-vous pris au téléphone"
        className="w-full rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-white inline-flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-[20px]">add_circle</span>
        Ajouter un rendez-vous
      </button>
    );
  }

  const canSubmit =
    !!serviceId &&
    startMin !== null &&
    contact.firstName.trim() &&
    contact.lastName.trim() &&
    contact.phone.trim().length >= 8 &&
    check?.available === true;

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-surface-container-low p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-extrabold font-['Manrope']">Nouveau rendez-vous</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fermer"
          className="w-8 h-8 grid place-items-center rounded-full hover:bg-white"
        >
          <span className="material-symbols-outlined text-outline">close</span>
        </button>
      </div>

      {services?.length === 0 ? (
        <p className="text-sm text-on-surface-variant leading-relaxed">
          Aucune prestation ne vous est attribuée pour l&apos;instant. Votre responsable les
          associe depuis « Équipe et horaires ».
        </p>
      ) : (
        <>
          <div>
            <span className={label}>Prestation</span>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className={input}
              disabled={!services}
            >
              {(services ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.section} · {s.label} — {s.durationMin} min · {s.price} €
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className={label}>Date</span>
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={input} />
            </div>
            <div>
              <span className={label}>Heure</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
            </div>
          </div>

          {/* Réponse du moteur, en une ligne dicible au téléphone. */}
          {checking && <p className="text-xs text-outline">Vérification…</p>}
          {!checking && check && (
            <div
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                check.available ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
              }`}
            >
              {check.available ? (
                <>Créneau libre{service ? ` · ${service.durationMin} min` : ""}.</>
              ) : (
                <>
                  {check.reason}
                  {check.alternatives.length > 0 && (
                    <span className="block mt-1.5 font-bold">
                      Proposez plutôt :{" "}
                      {check.alternatives.map((alt) => (
                        <button
                          key={alt}
                          type="button"
                          onClick={() => setTime(alt)}
                          className="mr-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-primary border border-amber-200"
                        >
                          {alt}
                        </button>
                      ))}
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className={label}>Prénom</span>
              <input
                value={contact.firstName}
                onChange={(e) => setContact((c) => ({ ...c, firstName: e.target.value }))}
                className={input}
                required
              />
            </div>
            <div>
              <span className={label}>Nom</span>
              <input
                value={contact.lastName}
                onChange={(e) => setContact((c) => ({ ...c, lastName: e.target.value }))}
                className={input}
                required
              />
            </div>
          </div>

          <div>
            <span className={label}>Téléphone</span>
            <input
              type="tel"
              value={contact.phone}
              onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
              className={input}
              required
            />
          </div>

          <div>
            <span className={label}>Note (facultatif)</span>
            <input
              value={contact.note}
              onChange={(e) => setContact((c) => ({ ...c, note: e.target.value }))}
              placeholder="Couleur à revoir, cliente pressée…"
              className={input}
            />
          </div>

          {error && <p className="text-sm font-semibold text-[#ba1a1a]">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit || saving}
            className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? "Enregistrement…" : "Enregistrer le rendez-vous"}
          </button>
        </>
      )}
    </form>
  );
}

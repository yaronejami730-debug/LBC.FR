"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export type FlowService = {
  id: string;
  section: string;
  label: string;
  durationMin: number | null;
  price: number;
  priceNote: string | null;
  bookable: boolean;
};

export type FlowMember = {
  id: string;
  displayName: string;
  role: string | null;
  color: string;
  serviceIds: string[];
};

export type FlowProfile = {
  name: string;
  slug: string;
  city: string | null;
  addressLine: string | null;
  postalCode: string | null;
  phone: string | null;
};

type Slot = { startMin: number; endMin: number; memberId: string; label: string; memberName: string };

const ANY = "any";

const STEPS = ["Prestation", "Praticien", "Date", "Heure", "Coordonnées", "Confirmation"] as const;

const card = "bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_8px_24px_rgba(21,21,125,0.04)]";
const input =
  "w-full bg-surface-container-low rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/50 border border-transparent focus:border-primary/30";

/**
 * Parcours de réservation en six étapes.
 *
 * Le composant ne calcule aucune disponibilité : il affiche ce que renvoie
 * `/api/booking/availability/*`. C'est la règle du module — le mobile appelle
 * exactement les mêmes routes, donc les deux clients ne peuvent pas diverger.
 *
 * Chaque changement d'étape relance la requête suivante avec un AbortController :
 * sans ça, une réponse lente d'un choix abandonné vient écraser l'affichage du
 * choix courant.
 */
export default function BookingFlow({
  profile,
  services,
  members,
  initialServiceId = null,
}: {
  profile: FlowProfile;
  services: FlowService[];
  members: FlowMember[];
  /** Prestation déjà choisie sur la fiche — on démarre alors au choix du praticien. */
  initialServiceId?: string | null;
}) {
  // Une prestation arrivant de la fiche n'est retenue que si elle est
  // réellement réservable : un identifiant recopié à la main ne doit pas
  // ouvrir un tunnel sur une ligne « sur devis ».
  const preselected =
    initialServiceId && services.find((s) => s.id === initialServiceId && s.bookable)
      ? initialServiceId
      : null;

  const [step, setStep] = useState(preselected ? 1 : 0);
  const [serviceId, setServiceId] = useState<string | null>(preselected);
  const [memberId, setMemberId] = useState<string>(ANY);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const { data: session, status: sessionStatus } = useSession();
  const signedIn = sessionStatus === "authenticated";

  /**
   * Où revenir après connexion ou inscription : sur la réservation, avec la
   * prestation déjà choisie. Renvoyer sur l'accueil ferait perdre le fil au
   * client et, avec lui, le rendez-vous.
   */
  const returnUrl = `/pro/${profile.slug}/reserver${initialServiceId ? `?service=${initialServiceId}` : ""}`;

  const [contact, setContact] = useState({ firstName: "", lastName: "", phone: "", email: "", note: "" });

  /**
   * Un client connecté ne doit pas ressaisir ce que le compte sait déjà. On ne
   * remplit que les champs restés vides : s'il a corrigé son email pour cette
   * réservation, on ne l'écrase pas.
   */
  useEffect(() => {
    if (!signedIn || !session?.user) return;
    const [first, ...rest] = (session.user.name ?? "").trim().split(/\s+/);
    setContact((c) => ({
      ...c,
      firstName: c.firstName || (first ?? ""),
      lastName: c.lastName || rest.join(" "),
      email: c.email || (session.user?.email ?? ""),
    }));
  }, [signedIn, session?.user]);

  const [openDays, setOpenDays] = useState<string[] | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ id: string; status: string } | null>(null);

  const service = useMemo(() => services.find((s) => s.id === serviceId) ?? null, [services, serviceId]);
  const eligible = useMemo(
    () => (serviceId ? members.filter((m) => m.serviceIds.includes(serviceId)) : []),
    [members, serviceId],
  );

  const bookable = services.filter((s) => s.bookable);
  const sections = useMemo(() => {
    const out = new Map<string, FlowService[]>();
    for (const s of bookable) {
      const list = out.get(s.section) ?? [];
      list.push(s);
      out.set(s.section, list);
    }
    return [...out.entries()];
  }, [bookable]);

  /* --- Chargement des jours ouverts, à l'entrée de l'étape Date --------- */
  useEffect(() => {
    if (step !== 2 || !serviceId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setOpenDays(null);

    const from = todayKey();
    const to = shiftKey(from, 60);
    fetch(
      `/api/booking/availability/days?serviceId=${serviceId}&memberId=${memberId}&from=${from}&to=${to}`,
      { signal: controller.signal },
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Disponibilités indisponibles");
        setOpenDays(data.days as string[]);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [step, serviceId, memberId]);

  /* --- Chargement des créneaux, à l'entrée de l'étape Heure ------------- */
  useEffect(() => {
    if (step !== 3 || !serviceId || !day) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setSlots(null);

    fetch(`/api/booking/availability/slots?serviceId=${serviceId}&memberId=${memberId}&day=${day}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Créneaux indisponibles");
        setSlots(data.slots as Slot[]);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [step, serviceId, memberId, day]);

  const submit = useCallback(async () => {
    if (!serviceId || !day || !slot) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          // Le créneau porte déjà le praticien retenu par le moteur : on le
          // renvoie tel quel plutôt que « peu importe », sinon le client peut
          // se retrouver avec quelqu'un d'autre que celui affiché.
          memberId: slot.memberId,
          day,
          startMin: slot.startMin,
          contact,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Réservation impossible");
      setConfirmed({ id: data.booking.id, status: data.booking.status });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [serviceId, day, slot, contact]);

  const contactValid =
    contact.firstName.trim() && contact.lastName.trim() && /\S+@\S+\.\S+/.test(contact.email) && contact.phone.trim().length >= 8;

  if (confirmed) {
    return (
      <div className={card}>
        <div className="flex items-center gap-2 text-emerald-600">
          <span className="material-symbols-outlined">check_circle</span>
          <h2 className="text-lg font-extrabold font-['Manrope']">
            {confirmed.status === "CONFIRMED" ? "Rendez-vous confirmé" : "Demande envoyée"}
          </h2>
        </div>
        <p className="text-sm text-outline mt-2">
          {confirmed.status === "CONFIRMED"
            ? "C'est noté. Vous recevrez un rappel avant le rendez-vous."
            : "L'établissement doit valider votre demande. Vous serez prévenu dès sa réponse."}
        </p>
        <Recap profile={profile} service={service} slot={slot} day={day} />
        <div className="mt-5 flex gap-2 flex-wrap">
          <Link href="/mes-reservations" title="Mes rendez-vous" className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white">
            Mes rendez-vous
          </Link>
          <Link href={`/pro/${profile.slug}`} title={profile.name} className="rounded-full bg-surface-container-low px-5 py-2.5 text-sm font-bold">
            Retour au salon
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Stepper current={step} />

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {/* Étape 1 — prestation */}
      {step === 0 && (
        <div className={card}>
          <h2 className="text-base font-extrabold font-['Manrope'] mb-3">Quelle prestation ?</h2>
          {bookable.length === 0 ? (
            <p className="text-sm text-outline">
              Aucune prestation n'est réservable en ligne pour le moment.
              {profile.phone && <> Appelez le {profile.phone}.</>}
            </p>
          ) : (
            sections.map(([section, list]) => (
              <div key={section} className="mb-4 last:mb-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-outline mb-2">{section}</p>
                <div className="space-y-2">
                  {list.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setServiceId(s.id);
                        setMemberId(ANY);
                        setDay(null);
                        setSlot(null);
                        setStep(1);
                      }}
                      className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                        serviceId === s.id ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <span className="font-bold text-sm">{s.label}</span>
                      <span className="block text-xs text-outline mt-0.5">
                        {s.durationMin} min · {s.price.toLocaleString("fr-FR")} €
                        {s.priceNote ? ` · ${s.priceNote}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Étape 2 — praticien */}
      {step === 1 && (
        <div className={card}>
          <h2 className="text-base font-extrabold font-['Manrope'] mb-3">Avec qui ?</h2>
          <div className="space-y-2">
            {eligible.length > 1 && (
              <Choice
                selected={memberId === ANY}
                onClick={() => {
                  setMemberId(ANY);
                  setStep(2);
                }}
                title="Peu importe"
                subtitle="Le premier créneau disponible dans l'équipe"
              />
            )}
            {eligible.map((m) => (
              <Choice
                key={m.id}
                selected={memberId === m.id}
                onClick={() => {
                  setMemberId(m.id);
                  setStep(2);
                }}
                title={m.displayName}
                subtitle={m.role ?? undefined}
                color={m.color}
              />
            ))}
            {eligible.length === 0 && (
              <p className="text-sm text-outline">Aucun praticien ne propose cette prestation.</p>
            )}
          </div>
        </div>
      )}

      {/* Étape 3 — date */}
      {step === 2 && (
        <div className={card}>
          <h2 className="text-base font-extrabold font-['Manrope'] mb-3">Quel jour ?</h2>
          {loading && <p className="text-sm text-outline">Recherche des disponibilités…</p>}
          {!loading && openDays?.length === 0 && (
            <p className="text-sm text-outline">
              Aucune disponibilité sur les 60 prochains jours.
              {profile.phone && <> Appelez le {profile.phone}.</>}
            </p>
          )}
          {!loading && !!openDays?.length && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {openDays.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDay(d);
                    setSlot(null);
                    setStep(3);
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize transition-colors ${
                    day === d ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-300"
                  }`}
                >
                  {formatDay(d)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Étape 4 — heure */}
      {step === 3 && (
        <div className={card}>
          <h2 className="text-base font-extrabold font-['Manrope'] mb-3">À quelle heure ?</h2>
          {loading && <p className="text-sm text-outline">Chargement des créneaux…</p>}
          {!loading && slots?.length === 0 && (
            <p className="text-sm text-outline">Plus aucun créneau ce jour-là. Choisissez une autre date.</p>
          )}
          {!loading && !!slots?.length && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {slots.map((s) => (
                <button
                  key={`${s.startMin}-${s.memberId}`}
                  type="button"
                  onClick={() => {
                    setSlot(s);
                    setStep(4);
                  }}
                  title={`${s.label} avec ${s.memberName}`}
                  className={`rounded-xl border px-2 py-2.5 text-sm font-bold transition-colors ${
                    slot?.startMin === s.startMin
                      ? "border-primary bg-primary/5"
                      : "border-slate-100 hover:border-slate-300"
                  }`}
                >
                  {s.label}
                  {memberId === ANY && (
                    <span className="block text-[10px] font-semibold text-outline mt-0.5 truncate">
                      {s.memberName}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Étape 5 — coordonnées */}
      {step === 4 && (
        <div className={card}>
          <h2 className="text-base font-extrabold font-['Manrope'] mb-3">Vos coordonnées</h2>

          {/* Incitation, pas barrage. Un client qui découvre le salon par une
              recherche Google n'a aucune raison d'avoir un compte, et lui en
              imposer un ferait perdre la réservation au professionnel. On
              propose donc le compte pour ce qu'il apporte — retrouver ses
              rendez-vous, annuler, revenir — et on laisse passer sans. */}
          {sessionStatus === "unauthenticated" && (
            <div className="mb-4 rounded-2xl border border-primary/25 bg-[#f5f9ff] p-4">
              <p className="text-sm font-bold text-primary">
                Créez votre compte Deal&amp;Co en 30 secondes
              </p>
              <ul className="mt-2 space-y-1 text-[13px] text-on-surface-variant">
                <li>· Retrouvez et annulez vos rendez-vous sans rappeler le salon</li>
                <li>· Vos coordonnées préremplies la prochaine fois</li>
                <li>· Et vendez ce dont vous ne vous servez plus, gratuitement</li>
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                {/* Pas de `callbackUrl` ici : l'inscription passe par une
                    vérification d'email, le retour immédiat n'existe pas et le
                    promettre serait une impasse. La connexion, elle, revient
                    bien sur la réservation. */}
                <Link
                  href="/register"
                  title="Créer un compte Deal&Co"
                  className="rounded-full bg-primary px-4 py-2 text-[13px] font-bold text-white"
                >
                  Créer mon compte
                </Link>
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(returnUrl)}`}
                  title="Se connecter"
                  className="rounded-full border border-primary/30 px-4 py-2 text-[13px] font-bold text-primary"
                >
                  J&apos;ai déjà un compte
                </Link>
              </div>
              <p className="mt-2 text-[11px] text-outline">
                Ou continuez sans compte, votre réservation sera confirmée par email.
              </p>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <input className={input} placeholder="Prénom" value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} />
            <input className={input} placeholder="Nom" value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} />
            <input className={input} type="tel" placeholder="Téléphone" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
            <input className={input} type="email" placeholder="Email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
          </div>
          <textarea
            className={`${input} mt-3 min-h-[80px]`}
            placeholder="Précision pour le salon (facultatif)"
            value={contact.note}
            onChange={(e) => setContact({ ...contact, note: e.target.value })}
          />
          <button
            type="button"
            disabled={!contactValid}
            onClick={() => setStep(5)}
            className="mt-4 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            Continuer
          </button>
        </div>
      )}

      {/* Étape 6 — confirmation */}
      {step === 5 && (
        <div className={card}>
          <h2 className="text-base font-extrabold font-['Manrope'] mb-3">Confirmer</h2>
          <Recap profile={profile} service={service} slot={slot} day={day} />
          <p className="text-xs text-outline mt-3">
            {contact.firstName} {contact.lastName} · {contact.phone} · {contact.email}
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={submit}
            className="mt-4 w-full rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Réservation…" : "Confirmer ma réservation"}
          </button>
        </div>
      )}

      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="text-sm font-semibold text-primary inline-flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Retour
        </button>
      )}
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1" aria-label="Étapes">
      {STEPS.map((label, i) => (
        <li
          key={label}
          aria-current={i === current ? "step" : undefined}
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
            i === current
              ? "bg-primary text-white"
              : i < current
                ? "bg-primary/10 text-primary"
                : "bg-surface-container-low text-outline"
          }`}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}

function Choice({
  selected,
  onClick,
  title,
  subtitle,
  color,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-4 py-3 flex items-center gap-3 transition-colors ${
        selected ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-300"
      }`}
    >
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-extrabold shrink-0"
        style={{ backgroundColor: color ?? "#94a3b8" }}
      >
        {title.slice(0, 1).toUpperCase()}
      </span>
      <span>
        <span className="font-bold text-sm block">{title}</span>
        {subtitle && <span className="text-xs text-outline">{subtitle}</span>}
      </span>
    </button>
  );
}

function Recap({
  profile,
  service,
  slot,
  day,
}: {
  profile: FlowProfile;
  service: FlowService | null;
  slot: Slot | null;
  day: string | null;
}) {
  if (!service || !slot || !day) return null;
  return (
    <dl className="mt-4 rounded-xl bg-surface-container-low p-4 text-sm space-y-1.5">
      <Row label="Prestation" value={`${service.label} · ${service.durationMin} min`} />
      <Row label="Praticien" value={slot.memberName} />
      <Row label="Date" value={formatDay(day)} />
      <Row label="Heure" value={slot.label} />
      <Row label="Prix" value={`${service.price.toLocaleString("fr-FR")} €`} />
      <Row label="Où" value={[profile.addressLine, profile.postalCode, profile.city].filter(Boolean).join(", ")} />
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-outline">{label}</dt>
      <dd className="font-semibold text-right">{value}</dd>
    </div>
  );
}

/* --- Dates : on reste sur des clés `YYYY-MM-DD`, jamais d'objet Date ----- *
 * Le serveur raisonne en heure de Paris. Manipuler des `Date` côté client
 * réintroduirait le fuseau du navigateur, et un client à Cayenne verrait ses
 * créneaux glisser d'un jour.                                              */

function todayKey(): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days, 12));
  return shifted.toISOString().slice(0, 10);
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

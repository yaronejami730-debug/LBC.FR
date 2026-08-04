"use client";

/**
 * Bloc « Devenir annonceur » de la page d'accueil.
 *
 * Le seul trafic entrant régulier du site arrive sur la home : c'est là qu'une
 * offre de sponsoring a une chance d'être vue. Le formulaire reste court — nom,
 * prénom, email, téléphone, budget — parce que chaque champ supplémentaire
 * coûte des conversions ; la qualification fine se fait pendant le rappel.
 *
 * Les chiffres affichés viennent de la base, jamais de valeurs inventées : un
 * annonceur qui découvre l'écart au premier appel ne signe pas.
 */

import { useState } from "react";
import { ADVERTISER_BUDGETS } from "@/lib/advertiser-budgets";

type Status = "idle" | "loading" | "success" | "error";

const FORMATS = [
  { icon: "wallpaper", label: "Bannière page d'accueil" },
  { icon: "category", label: "Mise en avant par catégorie" },
  { icon: "mail", label: "Encart emailing" },
  { icon: "article", label: "Article sponsorisé" },
];

function Field({
  id,
  icon,
  children,
}: {
  id: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-slate-400"
      >
        {icon}
      </span>
      {children}
    </div>
  );
}

const INPUT =
  "peer w-full pl-11 pr-4 py-3.5 rounded-xl border border-[#e6e9ee] bg-[#f8fafc] text-[#191c1e] text-sm placeholder:text-[#9aa2ad] focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/25 focus:border-[#2f6fb8] focus:bg-white transition";

export default function AdvertiserLeadSection({
  listingsCount,
  categoriesCount,
}: {
  listingsCount: number;
  categoriesCount: number;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [budget, setBudget] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!budget) {
      setErrorMsg("Sélectionnez un budget indicatif.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/advertiser-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          company,
          budget,
          message,
          source: "home",
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMsg(data.error ?? "Envoi impossible pour le moment. Réessayez.");
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setErrorMsg("Envoi impossible pour le moment. Réessayez.");
      setStatus("error");
    }
  }

  const stats = [
    { value: listingsCount.toLocaleString("fr-FR"), label: "annonces en ligne" },
    { value: String(categoriesCount), label: "catégories ciblables" },
    { value: "24-48 h", label: "délai de rappel" },
  ];

  return (
    <section
      id="annonceurs"
      className="scroll-mt-24 px-4 md:px-6 py-16 bg-gradient-to-b from-white to-[#eef2f6]"
    >
      <div className="max-w-7xl mx-auto">
        <div className="rounded-[28px] overflow-hidden shadow-[0_30px_70px_-30px_rgba(15,40,70,0.45)] grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
          {/* ---------- Argumentaire ---------- */}
          <div className="relative bg-[#0e2740] px-7 py-10 md:px-12 md:py-14 flex flex-col justify-center overflow-hidden">
            {/* Halos de marque — deux sources lumineuses, pas de dégradé plat. */}
            <div
              aria-hidden="true"
              className="absolute -top-24 -left-16 w-[26rem] h-[26rem] rounded-full opacity-40 blur-3xl"
              style={{ background: "radial-gradient(circle, #2f6fb8 0%, transparent 70%)" }}
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-32 right-0 w-[22rem] h-[22rem] rounded-full opacity-25 blur-3xl"
              style={{ background: "radial-gradient(circle, #3adfab 0%, transparent 70%)" }}
            />

            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#fbbf24]">
                <span className="material-symbols-outlined text-[14px]">campaign</span>
                Espaces publicitaires
              </span>

              <h2 className="font-headline text-white text-[2rem] md:text-[2.75rem] font-extrabold leading-[1.08] tracking-tight mt-5 text-balance">
                Placez votre marque là où l&apos;intention d&apos;achat est déjà là.
              </h2>

              <p className="text-white/70 mt-4 leading-relaxed max-w-md">
                Nos visiteurs ne viennent pas flâner : ils cherchent une voiture, un logement, un
                équipement. Vos formats s&apos;affichent au moment exact de la recherche.
              </p>

              {/* Preuves chiffrées — issues de la base, pas d'estimation marketing. */}
              <dl className="mt-9 flex flex-wrap gap-x-10 gap-y-5">
                {stats.map((s) => (
                  <div key={s.label}>
                    <dt className="sr-only">{s.label}</dt>
                    <dd className="font-headline text-3xl font-extrabold text-white tabular-nums leading-none">
                      {s.value}
                    </dd>
                    <p className="text-[11px] uppercase tracking-[0.1em] text-white/45 font-semibold mt-2">
                      {s.label}
                    </p>
                  </div>
                ))}
              </dl>

              <ul className="mt-9 flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <li
                    key={f.label}
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3.5 py-2 text-[13px] font-semibold text-white/85"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#60fcc6]">
                      {f.icon}
                    </span>
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ---------- Formulaire ---------- */}
          <div className="bg-white px-7 py-10 md:px-11 md:py-12">
            {status === "success" ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e9f6ef]">
                  <span className="material-symbols-outlined text-[32px] text-[#216b4d]">
                    check
                  </span>
                </span>
                <h3 className="font-headline text-2xl font-extrabold text-[#191c1e] mt-5">
                  Demande envoyée
                </h3>
                <p className="text-slate-500 text-sm mt-3 leading-relaxed max-w-xs">
                  Merci {firstName}. Nous vous rappelons au <strong>{phone}</strong> sous 24 à
                  48 heures ouvrées. Un email de confirmation vient de partir.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <h3 className="font-headline text-2xl font-extrabold text-[#191c1e] tracking-tight">
                    Parlons de votre campagne
                  </h3>
                  <p className="text-sm text-slate-500 mt-1.5">
                    Laissez vos coordonnées, on vous rappelle sous 24 à 48 h.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field id="adv-firstname" icon="person">
                    <label htmlFor="adv-firstname" className="sr-only">
                      Prénom
                    </label>
                    <input
                      id="adv-firstname"
                      className={INPUT}
                      placeholder="Prénom"
                      autoComplete="given-name"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </Field>
                  <Field id="adv-lastname" icon="badge">
                    <label htmlFor="adv-lastname" className="sr-only">
                      Nom
                    </label>
                    <input
                      id="adv-lastname"
                      className={INPUT}
                      placeholder="Nom"
                      autoComplete="family-name"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </Field>
                </div>

                <Field id="adv-company" icon="apartment">
                  <label htmlFor="adv-company" className="sr-only">
                    Société
                  </label>
                  <input
                    id="adv-company"
                    className={INPUT}
                    placeholder="Société (facultatif)"
                    autoComplete="organization"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field id="adv-email" icon="alternate_email">
                    <label htmlFor="adv-email" className="sr-only">
                      Adresse email
                    </label>
                    <input
                      id="adv-email"
                      type="email"
                      className={INPUT}
                      placeholder="Email professionnel"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                  <Field id="adv-phone" icon="call">
                    <label htmlFor="adv-phone" className="sr-only">
                      Téléphone
                    </label>
                    <input
                      id="adv-phone"
                      type="tel"
                      inputMode="tel"
                      className={INPUT}
                      placeholder="Téléphone"
                      autoComplete="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </Field>
                </div>

                {/* Le budget en pastilles : un clic au lieu d'un menu déroulant,
                    et les tranches restent lisibles d'un coup d'œil. */}
                <fieldset className="mt-1">
                  <legend className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400 mb-2.5">
                    Budget mensuel envisagé
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {ADVERTISER_BUDGETS.map((b) => (
                      <label
                        key={b.value}
                        className={`cursor-pointer rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                          budget === b.value
                            ? "border-[#2f6fb8] bg-[#2f6fb8] text-white"
                            : "border-[#e6e9ee] bg-white text-slate-500 hover:border-[#2f6fb8]/50 hover:text-[#2f6fb8]"
                        } has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#2f6fb8]/40`}
                      >
                        <input
                          type="radio"
                          name="budget"
                          value={b.value}
                          checked={budget === b.value}
                          onChange={() => setBudget(b.value)}
                          className="sr-only"
                        />
                        {b.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="adv-message" className="sr-only">
                    Votre projet
                  </label>
                  <textarea
                    id="adv-message"
                    rows={2}
                    className="w-full px-4 py-3.5 rounded-xl border border-[#e6e9ee] bg-[#f8fafc] text-[#191c1e] text-sm placeholder:text-[#9aa2ad] resize-none focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/25 focus:border-[#2f6fb8] focus:bg-white transition"
                    placeholder="Votre projet en deux lignes (facultatif)"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                {status === "error" && (
                  <p
                    role="alert"
                    className="flex items-center gap-2 text-sm text-[#b03a26] font-semibold"
                  >
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="group mt-1 w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#2f6fb8] py-4 text-sm font-extrabold text-white transition hover:bg-[#255a99] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === "loading" ? "Envoi…" : "Être rappelé sous 24-48 h"}
                  {status !== "loading" && (
                    <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-0.5">
                      arrow_forward
                    </span>
                  )}
                </button>

                <p className="text-[11px] text-slate-400 leading-relaxed text-center">
                  Vos coordonnées servent uniquement à vous rappeler au sujet de cette demande.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

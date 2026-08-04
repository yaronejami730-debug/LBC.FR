"use client";

/**
 * Bandeau « Devenir annonceur » de la page d'accueil.
 *
 * Volontairement discret : la home appartient aux annonces, pas à la régie.
 * Une ligne sobre en bas de page, et le formulaire ne se déplie qu'au clic —
 * un visiteur venu acheter ne le voit jamais, un annonceur le trouve.
 *
 * Les chiffres affichés viennent de la base, jamais de valeurs inventées : un
 * annonceur qui découvre l'écart au premier appel ne signe pas.
 */

import { useState } from "react";
import { ADVERTISER_BUDGETS } from "@/lib/advertiser-budgets";

type Status = "idle" | "loading" | "success" | "error";

const INPUT =
  "w-full px-3.5 py-2.5 rounded-lg border border-[#e6e9ee] bg-[#fafbfc] text-[#191c1e] text-sm placeholder:text-[#9aa2ad] focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/20 focus:border-[#2f6fb8] focus:bg-white transition";

export default function AdvertiserLeadSection({
  listingsCount,
  categoriesCount,
}: {
  listingsCount: number;
  categoriesCount: number;
}) {
  const [open, setOpen] = useState(false);
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

  return (
    <section id="annonceurs" className="scroll-mt-24 px-6 pt-4 pb-10 max-w-7xl mx-auto">
      <div className="rounded-2xl border border-surface-container bg-white">
        {/* Ligne d'accroche — toujours visible, jamais envahissante. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
          <span className="material-symbols-outlined text-[20px] text-outline">campaign</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-on-surface">
              Vous êtes une marque&nbsp;? Faites-vous sponsoriser par Deal&amp;Co.
            </p>
            <p className="text-xs text-outline mt-0.5">
              Bannières, mises en avant par catégorie, encarts emailing —{" "}
              {listingsCount.toLocaleString("fr-FR")} annonces et {categoriesCount} catégories
              ciblables. Rappel sous 24 à 48&nbsp;h.
            </p>
          </div>

          {status !== "success" && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="advertiser-form"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 px-4 py-2 text-xs font-bold text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
            >
              {open ? "Fermer" : "Être rappelé"}
              <span
                className={`material-symbols-outlined text-[16px] transition-transform ${open ? "rotate-180" : ""}`}
              >
                expand_more
              </span>
            </button>
          )}
        </div>

        {/* Formulaire — déplié à la demande. */}
        {(open || status === "success") && (
          <div id="advertiser-form" className="border-t border-surface-container px-5 py-5">
            {status === "success" ? (
              <p className="flex items-center gap-2 text-sm text-on-surface">
                <span className="material-symbols-outlined text-[20px] text-[#216b4d]">check_circle</span>
                Merci {firstName}, nous vous rappelons au <strong>{phone}</strong> sous 24 à
                48&nbsp;heures ouvrées.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-3xl">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
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
                  </div>
                  <div>
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
                  </div>
                  <div>
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
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
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
                  </div>
                  <div>
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
                  </div>
                </div>

                {/* Budget en pastilles : un clic au lieu d'un menu déroulant, et
                    les tranches restent lisibles d'un coup d'œil. */}
                <fieldset>
                  <legend className="text-[11px] font-bold uppercase tracking-[0.08em] text-outline mb-2">
                    Budget mensuel envisagé
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {ADVERTISER_BUDGETS.map((b) => (
                      <label
                        key={b.value}
                        className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#2f6fb8]/40 ${
                          budget === b.value
                            ? "border-primary bg-primary text-white"
                            : "border-outline-variant/40 bg-white text-on-surface-variant hover:border-primary hover:text-primary"
                        }`}
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
                    className={`${INPUT} resize-none`}
                    placeholder="Votre projet en deux lignes (facultatif)"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                {status === "error" && (
                  <p role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-[#b03a26]">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    {errorMsg}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === "loading" ? "Envoi…" : "Envoyer ma demande"}
                  </button>
                  <p className="text-[11px] text-outline">
                    Vos coordonnées servent uniquement à vous rappeler à ce sujet.
                  </p>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

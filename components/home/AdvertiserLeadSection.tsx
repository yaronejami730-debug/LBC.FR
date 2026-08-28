"use client";

/**
 * Bandeau « Faites-vous Sponsoriser par Deal&Co » de la page d'accueil.
 *
 * Plié : une seule phrase d'accroche, toute la barre est cliquable. Déplié :
 * le pitch, les arguments et le formulaire. Un visiteur venu acheter ne subit
 * qu'une ligne ; une marque qui clique a tout sous les yeux.
 */

import { useState } from "react";
import Icon from "@/components/Icon";
import { ADVERTISER_BUDGETS } from "@/lib/advertiser-budgets";

type Status = "idle" | "loading" | "success" | "error";

const INPUT =
  "w-full px-3.5 py-2.5 rounded-lg border border-[#dbe3ee] bg-white text-[#191c1e] text-sm placeholder:text-[#9aa2ad] focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/20 focus:border-[#2f6fb8] focus:bg-white transition";

/** Arguments de vente affichés en pastilles. Le nombre d'annonces n'y figure
 *  pas : ce qui intéresse un annonceur, c'est le nombre d'emplacements
 *  ciblables, pas le stock du jour. */
const SELLING_POINTS = [
  { icon: "category", label: "30+ catégories & sous-catégories" },
  { icon: "ads_click", label: "Bannière home, catégorie, emailing" },
  { icon: "public", label: "France entière + DOM-TOM" },
  { icon: "schedule", label: "Rappel sous 24 à 48 h" },
];

export default function AdvertiserLeadSection() {
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
    // Placé en tête de la home, entre la barre de catégories et la bannière
    // photo. La largeur et les marges latérales viennent du <header> parent.
    <section id="annonceurs" className="scroll-mt-24 mb-2">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#e9f2ff] via-[#f3f8ff] to-[#e6fbf3] ring-1 ring-inset ring-[#2f6fb8]/15">
        {/* Barre pliée : une seule phrase, toute la barre est cliquable. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="advertiser-form"
          className="group flex w-full items-center gap-3 px-4 py-3 text-left sm:px-6"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2f6fb8] text-white shadow-sm">
            <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-[13px] sm:text-sm font-extrabold text-[#0d2947]">
              Gagnez de nouveaux clients avec Deal&amp;Co Ads
              <span className="ml-2 hidden sm:inline rounded-full bg-[#00c190]/15 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-[#00795e]">
                Places limitées
              </span>
            </span>
            <span className="mt-0.5 block truncate text-[11px] sm:text-xs text-[#4a5c72]">
              Votre marque devant des milliers d&apos;acheteurs, dans plus d&apos;une trentaine de
              catégories.
            </span>
          </span>

          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] sm:text-xs font-bold text-[#2f6fb8] shadow-sm ring-1 ring-inset ring-[#2f6fb8]/20 transition group-hover:bg-[#2f6fb8] group-hover:text-white">
            <span className="hidden sm:inline">{open ? "Réduire" : "Je veux en savoir plus"}</span>
            <Icon name="expand_more" className={`material-symbols-outlined text-[18px] transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        </button>

        {/* Pitch — visible seulement une fois déplié. */}
        {(open || status === "success") && (
          <div className="border-t border-white/70 px-4 pt-5 sm:px-6">
            <h2 className="font-headline text-lg sm:text-xl font-extrabold leading-tight text-[#0d2947]">
              Faites-vous Sponsoriser par Deal&amp;Co.
            </h2>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-[#4a5c72]">
              Bannière d&apos;accueil, mise en avant par catégorie, encart emailing : votre marque
              s&apos;affiche là où les gens achètent, sur{" "}
              <strong className="font-bold text-[#0d2947]">
                plus d&apos;une trentaine de catégories et sous-catégories
              </strong>{" "}
              — auto, immobilier, mode, maison, high-tech, emploi, services. Tout est ciblable.
            </p>

            <ul className="mt-3 flex flex-wrap gap-1.5">
              {SELLING_POINTS.map((p) => (
                <li
                  key={p.label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[#33475f] ring-1 ring-inset ring-[#2f6fb8]/10"
                >
                  <span className="material-symbols-outlined text-[15px] text-[#2f6fb8]">
                    {p.icon}
                  </span>
                  {p.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Formulaire — déplié à la demande. */}
        {(open || status === "success") && (
          <div id="advertiser-form" className="px-4 pb-5 pt-4 sm:px-6">
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

            {/* Signature : le logo bleu ferme le modal en bas à droite. */}
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/70 pt-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7d8b9c]">
                Une offre
              </span>
              <img
                src="/logo-dealco.png"
                alt="Deal&Co"
                className="h-5 w-auto opacity-90"
                loading="lazy"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

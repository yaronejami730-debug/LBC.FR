"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

type ReportCategory =
  | "scam"
  | "spam"
  | "illegal"
  | "offensive"
  | "fake"
  | "wrong_category"
  | "duplicate"
  | "personal_data"
  | "stolen_photos"
  | "other";

const CATEGORIES: Array<{ id: ReportCategory; label: string; desc: string }> = [
  { id: "scam", label: "Arnaque ou fraude", desc: "Tentative d'escroquerie, paiement suspect" },
  { id: "spam", label: "Spam", desc: "Annonces répétées, contenu publicitaire" },
  { id: "illegal", label: "Contenu illicite", desc: "Produit ou service interdit par la loi" },
  { id: "offensive", label: "Contenu offensant", desc: "Propos haineux, discriminatoires ou injurieux" },
  { id: "fake", label: "Annonce fictive", desc: "Le bien ou le service n'existe pas" },
  { id: "wrong_category", label: "Mauvaise catégorie", desc: "Mal classée pour tromper l'acheteur" },
  { id: "duplicate", label: "Doublon", desc: "La même annonce est déjà publiée" },
  { id: "personal_data", label: "Données personnelles", desc: "Révèle les données privées d'un tiers" },
  { id: "stolen_photos", label: "Photos volées", desc: "Utilise des photos qui ne lui appartiennent pas" },
  { id: "other", label: "Autre", desc: "Décrivez le problème ci-dessous" },
];

/**
 * Signalement d'une annonce.
 *
 * Trois choses règlent l'essentiel du confort de lecture, et manquaient :
 *
 *  - la page derrière ne défile plus tant que la fenêtre est ouverte. Sans
 *    cela, le doigt qui parcourt les motifs faisait glisser l'annonce au
 *    travers, et la fenêtre semblait sauter ;
 *  - la fenêtre est centrée avec une marge garantie en haut comme en bas, au
 *    lieu d'être collée au bord de l'écran dès que la liste dépasse ;
 *  - seule la liste des motifs défile. L'en-tête et le bouton d'envoi restent
 *    visibles : on doit toujours voir ce qu'on est en train de faire et
 *    comment en sortir.
 */
export default function ReportButton({
  listingId,
  loggedIn,
}: {
  listingId: string;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Défilement de la page gelé, et Échap qui ferme : deux réflexes attendus de
  // n'importe quelle fenêtre modale, dont l'absence se remarque tout de suite.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) close();
    };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, submitting]);

  function openModal() {
    if (!loggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setTimeout(() => {
      setCategory(null);
      setMessage("");
      setDone(false);
      setError(null);
    }, 250);
  }

  async function submit() {
    if (!category) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, category, message: message.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Échec du signalement");
        return;
      }
      setDone(true);
    } catch {
      setError("Connexion interrompue, réessayez");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1.5 text-xs text-outline hover:text-red-500 transition-colors"
      >
        <span className="material-symbols-outlined text-[15px]">flag</span>
        Signaler cette annonce
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-6"
          onClick={() => !submitting && close()}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Signaler cette annonce"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            // `max-h` en dvh : sur mobile, la barre d'adresse mange une partie
            // de `vh` et le bouton d'envoi passait sous l'écran.
            className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[88dvh] sm:max-h-[80dvh] outline-none"
          >
            {/* Poignée de glissement : sur mobile, la fenêtre monte du bas et
                cette barre annonce qu'elle se referme vers le bas. */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
              <span className="h-1 w-10 rounded-full bg-slate-200" />
            </div>

            <div className="px-5 sm:px-6 pt-3 sm:pt-5 pb-3 border-b border-slate-100 shrink-0 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-on-surface font-['Manrope']">
                  Signaler l&apos;annonce
                </h2>
                <p className="text-xs text-outline mt-1 leading-relaxed">
                  Votre signalement est anonyme : le vendeur ne saura pas qu&apos;il vient de vous.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-outline hover:text-on-surface transition-colors shrink-0"
                aria-label="Fermer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {done ? (
              <div className="px-6 py-10 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 mx-auto flex items-center justify-center">
                  <span className="material-symbols-outlined text-emerald-600 text-[32px]">check</span>
                </div>
                <h3 className="mt-4 text-base font-bold text-on-surface">Signalement reçu</h3>
                <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
                  Merci. Notre équipe examine cette annonce et décide de la suite. Vous ne serez pas
                  informé du détail de la décision.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-6 px-6 py-2.5 rounded-full bg-primary text-white text-sm font-bold"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <div
                  role="radiogroup"
                  aria-label="Motif du signalement"
                  className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-3 space-y-1.5"
                >
                  {CATEGORIES.map((c) => {
                    const selected = category === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setCategory(c.id)}
                        className={`w-full text-left px-4 py-3 rounded-2xl border transition-colors flex items-start gap-3 ${
                          selected
                            ? "bg-primary/[0.06] border-primary"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 grid place-items-center transition-colors ${
                            selected ? "border-primary" : "border-slate-300"
                          }`}
                        >
                          {selected && <span className="w-2 h-2 rounded-full bg-primary" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-on-surface">{c.label}</span>
                          <span className="block text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                            {c.desc}
                          </span>
                        </span>
                      </button>
                    );
                  })}

                  <div className="pt-3">
                    <label
                      htmlFor="report-details"
                      className="text-xs font-bold text-on-surface uppercase tracking-wider"
                    >
                      Détails {category === "other" ? "" : "(facultatif)"}
                    </label>
                    <textarea
                      id="report-details"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder="Ce qui vous a alerté, en une phrase."
                      className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-primary focus:outline-none resize-none"
                    />
                    <p className="text-[10px] text-outline mt-1 text-right tabular-nums">
                      {message.length}/500
                    </p>
                  </div>
                </div>

                <div className="px-5 sm:px-6 py-4 border-t border-slate-100 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {error && (
                    <p className="text-xs text-red-500 mb-2 text-center font-medium">{error}</p>
                  )}
                  <button
                    type="button"
                    onClick={submit}
                    // « Autre » sans explication ne dit rien à la modération :
                    // c'est le seul motif où le détail est exigé.
                    disabled={!category || submitting || (category === "other" && !message.trim())}
                    className="w-full py-3 rounded-2xl bg-red-500 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                  >
                    {submitting ? "Envoi…" : "Envoyer le signalement"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

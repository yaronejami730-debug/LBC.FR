"use client";

import { useState } from "react";
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
  { id: "scam", label: "Arnaque / fraude", desc: "Tentative d'escroquerie ou paiement suspect" },
  { id: "spam", label: "Spam / publication massive", desc: "Annonces répétées, contenu publicitaire" },
  { id: "illegal", label: "Contenu illicite", desc: "Produits ou services interdits par la loi" },
  { id: "offensive", label: "Contenu offensant", desc: "Propos haineux, discriminatoires ou injurieux" },
  { id: "fake", label: "Annonce fictive", desc: "Le produit ou bien n'existe pas" },
  { id: "wrong_category", label: "Mauvaise catégorie", desc: "Mal classée pour induire en erreur" },
  { id: "duplicate", label: "Annonce en doublon", desc: "Même annonce déjà publiée ailleurs" },
  { id: "personal_data", label: "Données personnelles", desc: "Révèle des données privées d'une autre personne" },
  { id: "stolen_photos", label: "Photos volées", desc: "Utilise des photos qui ne lui appartiennent pas" },
  { id: "other", label: "Autre", desc: "Décrivez le problème ci-dessous" },
];

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
      setError("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center gap-1.5 text-xs text-outline hover:text-red-500 transition-colors"
      >
        <span className="material-symbols-outlined text-[15px]">flag</span>
        Signaler cette annonce
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-3 border-b border-slate-100 shrink-0 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-on-surface font-['Manrope']">
                  Signaler l&apos;annonce
                </h2>
                <p className="text-xs text-outline mt-1">
                  Ton signalement est anonyme. Notre équipe l&apos;examine sous 24 h.
                </p>
              </div>
              <button
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
                <p className="mt-2 text-sm text-on-surface-variant">
                  Merci. Notre équipe va examiner cette annonce.
                </p>
                <button
                  onClick={close}
                  className="mt-6 px-6 py-2.5 rounded-full bg-primary text-white text-sm font-bold"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategory(c.id)}
                      className={`w-full text-left px-4 py-3 rounded-2xl border transition-colors flex items-start gap-3 ${
                        category === c.id
                          ? "bg-primary/[0.06] border-primary"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
                          category === c.id ? "border-primary bg-primary" : "border-slate-300"
                        }`}
                      />
                      <div>
                        <div className="text-sm font-bold text-on-surface">{c.label}</div>
                        <div className="text-xs text-on-surface-variant mt-0.5">{c.desc}</div>
                      </div>
                    </button>
                  ))}

                  <div className="pt-3">
                    <label className="text-xs font-bold text-on-surface uppercase tracking-wider">
                      Détails (facultatif)
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder="Donne plus d'informations si besoin…"
                      className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-primary focus:outline-none resize-none"
                    />
                    <p className="text-[10px] text-outline mt-1">{message.length}/500</p>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 shrink-0">
                  {error && (
                    <p className="text-xs text-red-500 mb-2 text-center font-medium">{error}</p>
                  )}
                  <button
                    onClick={submit}
                    disabled={!category || submitting}
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

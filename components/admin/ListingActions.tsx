"use client";

import { useState, useTransition } from "react";
import { rejectListing, approveListing } from "@/app/admin/actions";
import {
  removeListingAction,
  restoreListingAction,
  reviewListingAction,
} from "@/app/admin/(protected)/securite/actions";

type Props = {
  listingId: string;
  status: string;
};

export default function ListingActions({ listingId, status }: Props) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [reviewReason, setReviewReason] = useState("");
  const [done, setDone] = useState<"approved" | "rejected" | "review" | null>(null);

  if (done) {
    const tone =
      done === "approved"
        ? "text-emerald-700 bg-emerald-100"
        : done === "review"
          ? "text-amber-800 bg-amber-100"
          : "text-[#ba1a1a] bg-[#ffdad6]";
    const icon = done === "approved" ? "check_circle" : done === "review" ? "rate_review" : "cancel";
    const label = done === "approved" ? "Validée" : done === "review" ? "En revue" : "Retirée";
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${tone}`}>
        <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          {icon}
        </span>
        {label}
      </span>
    );
  }

  // Refusée (jamais publiée) et retirée (publiée puis enlevée) partagent le
  // même écran d'action : dans les deux cas la seule décision restante est de
  // remettre l'annonce en ligne.
  if (status === "REJECTED" || status === "REMOVED" || status === "UNDER_REVIEW") {
    const removed = status === "REMOVED";
    const inReview = status === "UNDER_REVIEW";
    return (
      <div className="flex flex-col gap-1">
        {error && <p className="text-[10px] text-[#ba1a1a]">{error}</p>}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
              inReview ? "text-amber-800 bg-amber-100" : "text-[#ba1a1a] bg-[#ffdad6]"
            }`}
          >
            <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {inReview ? "rate_review" : removed ? "visibility_off" : "cancel"}
            </span>
            {inReview ? "En revue" : removed ? "Retirée" : "Refusée"}
          </span>
          <button
            onClick={() => {
              setError("");
              startTransition(async () => {
                try {
                  // Remettre en ligne une annonce retirée arrête son compte à
                  // rebours ; une annonce en revue n'en a jamais eu, une
                  // simple validation suffit.
                  if (removed) await restoreListingAction(listingId);
                  else await approveListing(listingId);
                  setDone("approved");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Erreur");
                }
              });
            }}
            disabled={isPending}
            className="text-[10px] text-[#777683] hover:text-[#2f6fb8] underline underline-offset-2 disabled:opacity-50"
          >
            {isPending ? "…" : "Remettre en ligne"}
          </button>
        </div>
      </div>
    );
  }

  if (status === "PENDING") {
    return (
      <div className="space-y-2">
        {error && <p className="text-[10px] text-[#ba1a1a]">{error}</p>}
        {!showReject ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setError("");
                startTransition(async () => {
                  try { await approveListing(listingId); setDone("approved"); }
                  catch (err) { setError(err instanceof Error ? err.message : "Erreur"); }
                });
              }}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[13px]">check_circle</span>
              {isPending ? "…" : "Valider"}
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-xs font-semibold bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffb4ab] px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[13px]">remove_circle</span>
              Refuser
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motif (optionnel)"
              className="text-xs border border-[#c7c5d4] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#ba1a1a] w-full"
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setError("");
                  startTransition(async () => {
                    try {
                      await rejectListing(listingId, reason);
                      setDone("rejected");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Erreur");
                    }
                  });
                }}
                disabled={isPending}
                className="text-xs bg-[#ba1a1a] text-white px-2.5 py-1.5 rounded-lg font-semibold disabled:opacity-50"
              >
                {isPending ? "…" : "Confirmer"}
              </button>
              <button
                onClick={() => { setShowReject(false); setReason(""); }}
                className="text-xs text-[#777683] hover:text-[#191c1e] py-1.5"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // APPROVED — seul bouton disponible : Retirer.
  //
  // Le motif est obligatoire ici, contrairement au refus d'une annonce jamais
  // publiée : retirer un contenu déjà en ligne déclenche un email à son auteur,
  // et un email de retrait sans motif est incompréhensible.
  return (
    <div className="space-y-2">
      {error && <p className="text-[10px] text-[#ba1a1a]">{error}</p>}

      {/* Passer en revue : l'annonce sort de la vitrine le temps d'une
          correction, sans sanction ni compte à rebours. C'est la réponse aux
          cas de forme — titre en double, photo trompeuse, prix manifestement
          faux — pour lesquels retirer serait disproportionné. */}
      {showReview && (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={reviewReason}
            onChange={(e) => setReviewReason(e.target.value)}
            rows={3}
            placeholder="Ce qui est à corriger, dans vos mots. Ex. : le titre de cette annonce est identique à celui d'une autre de vos annonces, précisez-le."
            className="text-xs border border-[#c7c5d4] rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500 w-full resize-none"
          />
          <p className="text-[10px] text-[#777683]">
            Envoyé tel quel à l&apos;auteur. L&apos;annonce revient en modération dès qu&apos;il la modifie.
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setError("");
                startTransition(async () => {
                  try {
                    await reviewListingAction(listingId, reviewReason);
                    setShowReview(false);
                    setReviewReason("");
                    setDone("review");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Erreur");
                  }
                });
              }}
              disabled={isPending || !reviewReason.trim()}
              className="text-xs bg-amber-500 text-white px-2.5 py-1.5 rounded-lg font-semibold disabled:opacity-50"
            >
              {isPending ? "…" : "Envoyer et mettre en pause"}
            </button>
            <button
              onClick={() => { setShowReview(false); setReviewReason(""); }}
              className="text-xs text-[#777683] hover:text-[#191c1e] py-1.5"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {!showReject && !showReview ? (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowReview(true)}
            disabled={isPending}
            className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-800 hover:bg-amber-200 px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[13px]">rate_review</span>
            Passer en revue
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={isPending}
            className="inline-flex items-center gap-1 text-xs font-semibold bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffb4ab] px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[13px]">remove_circle</span>
            Retirer l&apos;annonce
          </button>
        </div>
      ) : showReject ? (
        <div className="flex flex-col gap-1.5">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif (envoyé à l'utilisateur)"
            className="text-xs border border-[#c7c5d4] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#ba1a1a] w-full"
          />
          <p className="text-[10px] text-[#777683]">
            L'annonce devient invisible immédiatement. Son auteur a 21 jours pour la corriger.
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setError("");
                startTransition(async () => {
                  try {
                    await removeListingAction(listingId, reason);
                    setShowReject(false);
                    setReason("");
                    setDone("rejected");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Erreur");
                  }
                });
              }}
              disabled={isPending || !reason.trim()}
              className="text-xs bg-[#ba1a1a] text-white px-2.5 py-1.5 rounded-lg font-semibold disabled:opacity-50"
            >
              {isPending ? "…" : "Confirmer"}
            </button>
            <button
              onClick={() => { setShowReject(false); setReason(""); }}
              className="text-xs text-[#777683] hover:text-[#191c1e] py-1.5"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

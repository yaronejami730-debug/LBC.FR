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

/**
 * Trois décisions, trois poids visuels.
 *
 * Valider est l'issue de la très grande majorité des annonces : c'est le seul
 * bouton plein. Mettre en revue demande une correction, elle se signale en
 * ambre sans dramatiser. Refuser et retirer sont irréversibles pour l'auteur —
 * bordure rouge, jamais de fond plein : un bouton destructeur aussi appuyé
 * qu'un bouton de validation se clique par réflexe.
 */
const BTN = {
  base: "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100",
  approve: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700",
  review: "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
  danger: "border border-[#ffb4ab] bg-white text-[#ba1a1a] hover:bg-[#fff1f0]",
  ghost: "text-[13px] font-semibold text-[#777683] hover:text-[#191c1e]",
} as const;

/** Panneau de saisie d'un motif : même cadre pour le refus et la revue. */
function ReasonPanel({
  tone,
  title,
  hint,
  placeholder,
  value,
  onChange,
  onConfirm,
  onCancel,
  confirmLabel,
  pending,
  required,
}: {
  tone: "amber" | "red";
  title: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
  pending: boolean;
  required: boolean;
}) {
  const amber = tone === "amber";
  return (
    <div
      className={`rounded-2xl border p-3 ${
        amber ? "border-amber-200 bg-amber-50/60" : "border-[#ffb4ab] bg-[#fff8f7]"
      }`}
    >
      <p
        className={`text-[11px] font-bold uppercase tracking-wider ${
          amber ? "text-amber-800" : "text-[#ba1a1a]"
        }`}
      >
        {title}
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className={`mt-2 w-full resize-none rounded-xl border bg-white px-3 py-2 text-[13px] outline-none transition-colors ${
          amber
            ? "border-amber-200 focus:border-amber-500"
            : "border-[#ffb4ab] focus:border-[#ba1a1a]"
        }`}
      />
      <p className="mt-1.5 text-[11px] leading-relaxed text-[#777683]">{hint}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <button
          onClick={onConfirm}
          disabled={pending || (required && !value.trim())}
          className={`${BTN.base} ${
            amber
              ? "bg-amber-500 text-white shadow-sm shadow-amber-500/20 hover:bg-amber-600"
              : "bg-[#ba1a1a] text-white shadow-sm shadow-[#ba1a1a]/20 hover:bg-[#9f1414]"
          }`}
        >
          {pending ? "…" : confirmLabel}
        </button>
        <button onClick={onCancel} className={BTN.ghost}>
          Annuler
        </button>
      </div>
    </div>
  );
}

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
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold ${tone}`}
      >
        <span
          className="material-symbols-outlined text-[15px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
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

  const approve = () => {
    setError("");
    startTransition(async () => {
      try {
        await approveListing(listingId);
        setDone("approved");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  if (status === "PENDING") {
    return (
      <div className="space-y-2">
        {error && <p className="text-[11px] font-semibold text-[#ba1a1a]">{error}</p>}

        {showReject ? (
          <ReasonPanel
            tone="red"
            title="Refuser l'annonce"
            placeholder="Motif envoyé à l'auteur. Ex. : les photos ne montrent pas l'objet vendu."
            hint="L'annonce ne sera jamais publiée. Sans motif, son auteur ne saura pas quoi corriger."
            value={reason}
            onChange={setReason}
            confirmLabel="Confirmer le refus"
            pending={isPending}
            required={false}
            onCancel={() => {
              setShowReject(false);
              setReason("");
            }}
            onConfirm={() => {
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
          />
        ) : showReview ? (
          <ReasonPanel
            tone="amber"
            title="Demander une correction"
            placeholder="Ce qui est à corriger, dans vos mots. Ex. : le prix affiché ne correspond pas à la description."
            hint="Envoyé tel quel à l'auteur. L'annonce revient en modération dès qu'il la modifie."
            value={reviewReason}
            onChange={setReviewReason}
            confirmLabel="Envoyer la demande"
            pending={isPending}
            required
            onCancel={() => {
              setShowReview(false);
              setReviewReason("");
            }}
            onConfirm={() => {
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
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={approve} disabled={isPending} className={`${BTN.base} ${BTN.approve}`}>
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              {isPending ? "…" : "Valider"}
            </button>
            {/* Troisième voie, qui manquait ici : tout ce qui n'est ni bon ni
                condamnable finissait refusé faute de bouton intermédiaire. */}
            <button
              onClick={() => setShowReview(true)}
              disabled={isPending}
              className={`${BTN.base} ${BTN.review}`}
            >
              <span className="material-symbols-outlined text-[16px]">rate_review</span>
              À corriger
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={isPending}
              className={`${BTN.base} ${BTN.danger}`}
            >
              <span className="material-symbols-outlined text-[16px]">remove_circle</span>
              Refuser
            </button>
          </div>
        )}
      </div>
    );
  }

  // APPROVED — retirer ou demander une correction.
  //
  // Le motif est obligatoire des deux côtés : retirer un contenu déjà en ligne
  // déclenche un e-mail à son auteur, et un e-mail de retrait sans motif est
  // incompréhensible.
  return (
    <div className="space-y-2">
      {error && <p className="text-[11px] font-semibold text-[#ba1a1a]">{error}</p>}

      {showReview ? (
        <ReasonPanel
          tone="amber"
          title="Passer en revue"
          placeholder="Ce qui est à corriger, dans vos mots. Ex. : le titre de cette annonce est identique à celui d'une autre de vos annonces."
          hint="L'annonce sort de la vitrine sans sanction ni compte à rebours. Elle revient en modération dès que l'auteur la modifie."
          value={reviewReason}
          onChange={setReviewReason}
          confirmLabel="Envoyer et mettre en pause"
          pending={isPending}
          required
          onCancel={() => {
            setShowReview(false);
            setReviewReason("");
          }}
          onConfirm={() => {
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
        />
      ) : showReject ? (
        <ReasonPanel
          tone="red"
          title="Retirer l'annonce"
          placeholder="Motif envoyé à l'auteur."
          hint="L'annonce devient invisible immédiatement. Son auteur a 21 jours pour la corriger avant suppression définitive."
          value={reason}
          onChange={setReason}
          confirmLabel="Confirmer le retrait"
          pending={isPending}
          required
          onCancel={() => {
            setShowReject(false);
            setReason("");
          }}
          onConfirm={() => {
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
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowReview(true)}
            disabled={isPending}
            className={`${BTN.base} ${BTN.review}`}
          >
            <span className="material-symbols-outlined text-[16px]">rate_review</span>
            Passer en revue
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={isPending}
            className={`${BTN.base} ${BTN.danger}`}
          >
            <span className="material-symbols-outlined text-[16px]">visibility_off</span>
            Retirer
          </button>
        </div>
      )}
    </div>
  );
}

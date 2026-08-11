import Link from "next/link";
import { daysUntilDeletion, formatDeadline } from "@/lib/moderation/removal";

/**
 * Bandeau affiché à l'auteur d'une annonce retirée ou refusée.
 *
 * Trois informations, dans cet ordre : ce qui s'est passé, pourquoi, et
 * jusqu'à quand il est possible d'agir. Le compte à rebours est explicite
 * parce que la date seule ne se calcule pas de tête — « jusqu'au 30/08 » ne
 * dit pas s'il reste deux jours ou trois semaines.
 *
 * Visible uniquement du propriétaire : la page renvoie déjà 404 aux autres.
 */
export function RemovedNotice({
  listingId,
  status,
  reason,
  permanentDeletionAt,
  compact = false,
}: {
  listingId: string;
  status: string;
  reason?: string | null;
  permanentDeletionAt?: Date | string | null;
  compact?: boolean;
}) {
  if (status !== "REMOVED" && status !== "REJECTED" && status !== "UNDER_REVIEW") return null;

  const deadline = permanentDeletionAt ? new Date(permanentDeletionAt) : null;
  const days = daysUntilDeletion(deadline);
  const removed = status === "REMOVED";
  // Mise en revue : ni sanction ni suppression programmée. Le bandeau change
  // donc de couleur et de vocabulaire — parler de « retrait » à quelqu'un à
  // qui on demande juste de renommer son annonce le fait paniquer pour rien.
  const inReview = status === "UNDER_REVIEW";

  if (compact) {
    return (
      <div
        className={`rounded-xl border px-3 py-2 ${
          inReview ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200"
        }`}
      >
        <p className={`text-xs font-bold ${inReview ? "text-amber-900" : "text-rose-800"}`}>
          {inReview ? "Correction demandée" : removed ? "Annonce retirée" : "Annonce refusée"}
        </p>
        {days !== null && (
          <p className="text-[11px] text-rose-700/90 mt-0.5">
            {days === 0
              ? "Suppression définitive imminente"
              : `Suppression définitive dans ${days} jour${days > 1 ? "s" : ""}`}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`mx-4 md:mx-6 mt-4 rounded-2xl border p-5 ${
        inReview ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`material-symbols-outlined text-[22px] shrink-0 ${
            inReview ? "text-amber-600" : "text-rose-600"
          }`}
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {inReview ? "rate_review" : "visibility_off"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={`font-extrabold ${inReview ? "text-amber-900" : "text-rose-900"}`}>
            {inReview
              ? "Une correction est demandée"
              : removed
                ? "Annonce retirée"
                : "Annonce non publiée"}
          </h2>
          <p className={`text-sm mt-1 ${inReview ? "text-amber-900/90" : "text-rose-800/90"}`}>
            {inReview
              ? "Votre annonce est en pause le temps que vous la modifiiez. Aucune suppression n'est programmée."
              : "Cette annonce n'est actuellement pas visible sur Deal&Co."}
          </p>

          {reason && (
            <div className="mt-3 rounded-xl bg-white/70 border border-rose-200 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                Motif
              </p>
              <p className="text-sm text-slate-700 mt-1">{reason}</p>
            </div>
          )}

          {deadline && (
            <p className="text-sm text-rose-800/90 mt-3">
              Vous avez jusqu'au{" "}
              <strong className="text-rose-900">{formatDeadline(deadline)}</strong> pour la modifier
              et demander une nouvelle validation.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Link
              href={`/annonce/${listingId}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
              Modifier mon annonce
            </Link>

            {days !== null && (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-rose-800">
                <span className="material-symbols-outlined text-[18px]">hourglass_bottom</span>
                {days === 0
                  ? "Suppression définitive imminente"
                  : `Suppression définitive dans ${days} jour${days > 1 ? "s" : ""}`}
              </span>
            )}
          </div>

          <p className="text-xs text-rose-700/70 mt-3">
            Une annonce modifiée repasse par la modération : elle n'est pas remise en ligne
            automatiquement.
          </p>
        </div>
      </div>
    </div>
  );
}

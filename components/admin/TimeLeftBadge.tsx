import { formatTimeLeft, timeLeftLevel, listingExpiresAt } from "@/lib/listing-lifetime";

/**
 * Temps restant avant retrait automatique d'une annonce.
 *
 * L'administration voyait l'âge de l'annonce, jamais son échéance : impossible
 * de savoir laquelle allait disparaître cette semaine. Rendu côté serveur, donc
 * à la granularité du jour — suffisant pour une durée de vie de 300 jours, et
 * la date exacte reste lisible au survol.
 */
export default function TimeLeftBadge({ createdAt }: { createdAt: Date | string }) {
  const level = timeLeftLevel(createdAt);
  const tone =
    level === "expire"
      ? "text-[#ba1a1a] bg-[#fff8f7]"
      : level === "urgent"
        ? "text-amber-700 bg-amber-50"
        : level === "bientot"
          ? "text-[#464652] bg-[#f2f4f6]"
          : "text-emerald-700 bg-emerald-50";

  return (
    <span
      title={`Retrait automatique le ${listingExpiresAt(createdAt).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })}`}
      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${tone}`}
    >
      {formatTimeLeft(createdAt)}
    </span>
  );
}

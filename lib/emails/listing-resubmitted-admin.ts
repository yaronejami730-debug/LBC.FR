import { baseEmail } from "./base";
import { escapeHtml } from "./escape";

/**
 * Annonce modifiée par son auteur — avis à la modération.
 *
 * L'e-mail existant ne partait qu'à la publication d'une **nouvelle** annonce.
 * Une annonce refusée en janvier, corrigée en juillet, repassait en attente
 * sans que personne n'en soit informé : elle attendait dans la file jusqu'à ce
 * qu'un administrateur ouvre le back-office par hasard. Du point de vue du
 * vendeur, c'est un refus définitif sans explication.
 *
 * Le message dit trois choses, dans cet ordre : ce qui a changé, d'où l'annonce
 * revient, et où trancher. Un avis de modération qui oblige à rouvrir l'annonce
 * pour comprendre ce qui a bougé ne fait pas gagner de temps.
 */

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "en ligne",
  PENDING: "en attente de validation",
  REJECTED: "refusée",
  REMOVED: "retirée",
  UNDER_REVIEW: "en revue",
  EXPIRED: "expirée",
  SOLD: "vendue",
};

export function listingResubmittedAdminEmail({
  sellerName,
  listingTitle,
  price,
  category,
  location,
  previousStatus,
  changedFields,
  previousReason,
  listingUrl,
  adminUrl,
}: {
  sellerName: string;
  listingTitle: string;
  price: number;
  category: string;
  location: string;
  /** État avant la modification : c'est lui qui donne l'urgence. */
  previousStatus: string;
  /** Champs réellement modifiés, en clair. */
  changedFields: string[];
  /** Motif du refus ou du retrait précédent, s'il y en avait un. */
  previousReason?: string | null;
  listingUrl: string;
  adminUrl: string;
}): string {
  const sanctioned = ["REJECTED", "REMOVED", "UNDER_REVIEW"].includes(previousStatus);
  const was = STATUS_LABEL[previousStatus] ?? previousStatus.toLowerCase();

  const accent = sanctioned ? "#d97706" : "#2f6fb8";
  const tint = sanctioned ? "#fffbeb" : "#f1f6fc";

  const changes =
    changedFields.length > 0
      ? `<ul style="margin:8px 0 0;padding-left:18px;color:#424751;font-size:13px;line-height:1.7;">
           ${changedFields.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
         </ul>`
      : `<p style="margin:8px 0 0;font-size:13px;color:#727782;">Modification mineure.</p>`;

  return baseEmail({
    title: "Annonce modifiée — Deal & Co",
    heading: sanctioned ? "Annonce corrigée à revoir" : "Annonce modifiée à valider",
    // `adSource` admin côté envoi : aucun encart publicitaire ici.
    body: `
      <p style="margin:0 0 16px;">
        ${
          sanctioned
            ? `Une annonce <strong>${escapeHtml(was)}</strong> vient d'être corrigée par son auteur. Elle est repassée en validation humaine et attend une décision.`
            : `Une annonce déjà publiée vient d'être modifiée. Elle est repassée en validation humaine.`
        }
      </p>

      <div style="background:${tint};border-left:3px solid ${accent};border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 16px;text-align:left;">
        <p style="font-size:14px;color:#1a1b25;font-weight:700;margin:0 0 6px;">${escapeHtml(listingTitle)}</p>
        <p style="font-size:13px;color:#424751;margin:0 0 4px;">Vendeur : <strong>${escapeHtml(sellerName)}</strong></p>
        <p style="font-size:13px;color:#424751;margin:0 0 4px;">${escapeHtml(category)} · ${escapeHtml(location)}</p>
        <p style="font-size:13px;color:${accent};font-weight:700;margin:0;">${price.toLocaleString("fr-FR")} €</p>
      </div>

      <div style="text-align:left;margin:0 0 16px;">
        <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ea4a9;margin:0;">
          Ce qui a changé
        </p>
        ${changes}
      </div>

      ${
        previousReason
          ? `<div style="text-align:left;margin:0 0 16px;">
               <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ea4a9;margin:0 0 6px;">
                 Motif précédent
               </p>
               <p style="font-size:13px;color:#424751;line-height:1.7;margin:0;">${escapeHtml(previousReason)}</p>
             </div>`
          : ""
      }

      <p style="margin:0;font-size:13px;color:#727782;">
        <a href="${escapeHtml(listingUrl)}" style="color:#2f6fb8;">Voir l'annonce telle qu'elle est</a>
      </p>
    `,
    ctaLabel: "Ouvrir la modération",
    ctaUrl: adminUrl,
  });
}

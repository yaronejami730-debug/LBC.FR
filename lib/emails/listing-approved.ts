import { baseEmail } from "./base";
import { escapeHtml } from "./escape";

export function listingApprovedEmail({
  name,
  listingTitle,
  listingUrl,
}: {
  name: string;
  listingTitle: string;
  listingUrl: string;
}): string {
  return baseEmail({
    title: "Votre annonce est en ligne — Deal & Co",
    heading: "Votre annonce est publiée\u00a0!",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${escapeHtml(name)}</strong>,</p>
      <p style="margin:0 0 16px;">Bonne nouvelle — votre annonce <strong style="color:#1a1b25;">« ${escapeHtml(listingTitle)} »</strong> a été validée et est maintenant visible par tous les utilisateurs de Deal&nbsp;&amp;&nbsp;Co.</p>
      <p style="margin:0;">Les acheteurs intéressés peuvent désormais vous contacter directement via la messagerie intégrée.</p>
    `,
    ctaLabel: "Voir mon annonce",
    ctaUrl: listingUrl,
    postCta:
      "Vous pouvez modifier ou supprimer votre annonce à tout moment depuis votre espace personnel.",
  });
}

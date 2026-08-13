import { baseEmail } from "./base";
import { escapeHtml } from "./escape";

export function newConversationEmail({
  name,
  buyerName,
  listingTitle,
  listingUrl,
}: {
  name: string;
  buyerName: string;
  listingTitle: string;
  listingUrl: string;
}): string {
  return baseEmail({
    title: `${escapeHtml(buyerName)} est intéressé par votre annonce — Deal & Co`,
    heading: "Quelqu'un est intéressé par votre annonce",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${escapeHtml(name)}</strong>,</p>
      <p style="margin:0 0 16px;"><strong style="color:#1a1b25;">${escapeHtml(buyerName)}</strong> vient de vous envoyer un premier message concernant votre annonce <strong style="color:#1a1b25;">« ${escapeHtml(listingTitle)} »</strong>.</p>
      <p style="margin:0;">Répondez-lui rapidement pour ne pas laisser passer une opportunité de vente.</p>
    `,
    ctaLabel: "Voir la conversation",
    ctaUrl: listingUrl,
    postCta:
      "Pensez à marquer votre annonce comme vendue une fois la transaction effectuée.",
  });
}

import { baseEmail } from "./base";

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
    title: `${buyerName} est intéressé par votre annonce — Deal & Co`,
    heading: "Quelqu'un est intéressé par votre annonce",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;"><strong style="color:#1a1b25;">${buyerName}</strong> vient de vous envoyer un premier message concernant votre annonce <strong style="color:#1a1b25;">« ${listingTitle} »</strong>.</p>
      <p style="margin:0;">Répondez-lui rapidement pour ne pas laisser passer une opportunité de vente.</p>
    `,
    ctaLabel: "Voir la conversation",
    ctaUrl: listingUrl,
    postCta:
      "Pensez à marquer votre annonce comme vendue une fois la transaction effectuée.",
  });
}

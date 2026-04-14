import { baseEmail } from "./base";

export function newFavoriteEmail({
  name,
  listingTitle,
  listingUrl,
}: {
  name: string;
  listingTitle: string;
  listingUrl: string;
}): string {
  return baseEmail({
    title: "Votre annonce plaît — Deal & Co",
    heading: "Votre annonce a été mise en favori",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">Un utilisateur vient d'ajouter votre annonce <strong style="color:#1a1b25;">« ${listingTitle} »</strong> à ses favoris — il est potentiellement intéressé.</p>
      <p style="margin:0;">Assurez-vous que votre annonce est à jour et que votre messagerie est bien activée pour ne manquer aucune opportunité.</p>
    `,
    ctaLabel: "Voir mon annonce",
    ctaUrl: listingUrl,
  });
}

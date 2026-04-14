import { baseEmail } from "./base";

export function listingSoldEmail({
  name,
  listingTitle,
  searchUrl,
}: {
  name: string;
  listingTitle: string;
  searchUrl: string;
}): string {
  return baseEmail({
    title: "Félicitations pour votre vente — Deal & Co",
    heading: "Félicitations pour votre vente\u00a0!",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">Votre annonce <strong style="color:#1a1b25;">« ${listingTitle} »</strong> a été marquée comme vendue. C'est une bonne affaire de conclue !</p>
      <p style="margin:0;">Vous avez d'autres articles à vendre ? Déposez une nouvelle annonce gratuitement en quelques secondes.</p>
    `,
    ctaLabel: "Déposer une nouvelle annonce",
    ctaUrl: "https://www.dealandcompany.fr/post",
    postCta:
      "Merci d'utiliser Deal & Co. Votre satisfaction est notre priorité.",
  });
}

import { baseEmail } from "./base";

export function reengagementEmail({
  name,
  newListingsCount,
}: {
  name: string;
  newListingsCount: number;
}): string {
  return baseEmail({
    title: "De nouvelles annonces vous attendent — Deal & Co",
    heading: "De nouvelles annonces vous attendent",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">Vous nous manquez ! Depuis votre dernière visite, <strong style="color:#1a1b25;">${newListingsCount} nouvelles annonces</strong> ont été publiées sur Deal&nbsp;&amp;&nbsp;Co.</p>
      <p style="margin:0;">Venez découvrir les dernières bonnes affaires près de chez vous — voitures, immobilier, mode, électronique et bien plus encore, entre particuliers.</p>
    `,
    ctaLabel: "Voir les nouvelles annonces",
    ctaUrl: "https://www.dealandcompany.fr/search",
    postCta: "Vous recevez cet email car vous êtes inscrit sur dealandcompany.fr. Pour ne plus recevoir ces emails, connectez-vous et gérez vos préférences.",
  });
}

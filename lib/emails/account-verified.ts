import { baseEmail } from "./base";

export function accountVerifiedEmail({ name }: { name: string }): string {
  return baseEmail({
    title: "Compte vérifié — Deal & Co",
    heading: "Votre compte est maintenant vérifié\u00a0✓",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">Félicitations — votre compte <strong style="color:#1a1b25;">Deal&nbsp;&amp;&nbsp;Co</strong> est désormais vérifié. Le badge de vérification apparaît sur votre profil et inspire confiance aux autres utilisateurs.</p>
      <p style="margin:0;">Vos annonces bénéficient d'une meilleure visibilité et vos acheteurs sont plus enclins à vous contacter.</p>
    `,
    ctaLabel: "Voir mon profil",
    ctaUrl: "https://www.dealandcompany.fr/profile",
  });
}

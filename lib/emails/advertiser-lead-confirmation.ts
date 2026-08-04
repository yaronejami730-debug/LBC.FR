import { baseEmail } from "./base";

/** Accusé de réception envoyé à l'annonceur qui vient de laisser ses coordonnées. */
export function advertiserLeadConfirmationEmail({
  firstName,
  phone,
}: {
  firstName: string;
  phone: string;
}): string {
  return baseEmail({
    title: "Votre demande est bien reçue — Deal & Co",
    heading: "Votre demande est bien reçue",
    body: `
      <p style="margin:0 0 16px;">Bonjour ${firstName},</p>
      <p style="margin:0 0 16px;">Merci pour votre intérêt. Un membre de l'équipe Deal&nbsp;&amp;&nbsp;Co vous rappelle au <strong>${phone}</strong> sous 24 à 48 heures ouvrées pour construire votre campagne.</p>
      <p style="margin:0 0 16px;">D'ici là, vous n'avez rien à faire. Si vous préférez être joint à un autre moment ou sur un autre numéro, répondez simplement à cet email.</p>
      <p style="margin:0;">À très vite,<br/>L'équipe Deal&nbsp;&amp;&nbsp;Co</p>
    `,
    ctaLabel: "Découvrir Deal & Co",
    ctaUrl: "https://www.dealandcompany.fr",
  });
}

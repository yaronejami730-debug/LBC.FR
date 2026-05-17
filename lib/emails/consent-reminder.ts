import { baseEmail } from "./base";

/**
 * Email de relance pour les utilisateurs n'ayant pas accepté les CGU
 * ni la politique de confidentialité.
 */
export function consentReminderEmail({
  name,
  acceptUrl,
}: {
  name: string;
  acceptUrl: string;
}): string {
  return baseEmail({
    title: "Action requise : acceptez nos CGU et notre politique de confidentialité — Deal & Co",
    heading: "Une dernière étape sur votre compte",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">En consultant votre compte, nous avons constaté que vous n'avez pas encore accepté nos <strong style="color:#1a1b25;">Conditions Générales d'Utilisation</strong> ni notre <strong style="color:#1a1b25;">Politique de Confidentialité</strong>.</p>
      <p style="margin:0 0 16px;">Cette acceptation est nécessaire pour continuer à utiliser votre compte Deal&nbsp;&amp;&nbsp;Co en toute conformité. L'opération ne prend qu'une minute.</p>
      <p style="margin:0;">Cliquez sur le bouton ci-dessous pour finaliser cette étape.</p>
    `,
    ctaLabel: "Accepter et continuer",
    ctaUrl: acceptUrl,
    postCta:
      "Vous pouvez consulter à tout moment nos Conditions Générales d'Utilisation sur dealandcompany.fr/cgu et notre Politique de Confidentialité sur dealandcompany.fr/confidentialite.",
  });
}

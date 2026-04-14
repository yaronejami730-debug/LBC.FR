import { baseEmail } from "./base";

export function resetPasswordEmail({ name, resetUrl }: { name: string; resetUrl: string }): string {
  return baseEmail({
    title: "Réinitialisation de votre mot de passe — Deal & Co",
    heading: "Réinitialisez votre mot de passe",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">Nous avons reçu une demande de réinitialisation du mot de passe associé à votre compte <strong style="color:#1a1b25;">Deal&nbsp;&amp;&nbsp;Co</strong>.</p>
      <p style="margin:0;">Pour choisir un nouveau mot de passe, cliquez sur le bouton ci-dessous. Ce lien est valable <strong style="color:#1a1b25;">1 heure</strong>.</p>
    `,
    ctaLabel: "Réinitialiser mon mot de passe",
    ctaUrl: resetUrl,
    postCta:
      "Si vous n'avez pas demandé de réinitialisation, ignorez cet email. Votre mot de passe reste inchangé et votre compte est en sécurité.",
  });
}

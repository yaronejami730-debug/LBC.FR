import { baseEmail } from "./base";

export function verifyEmail({ name, verifyUrl }: { name: string; verifyUrl: string }): string {
  return baseEmail({
    title: "Confirmez votre adresse email — Deal & Co",
    heading: "Confirmez votre email",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">Merci de vous être inscrit sur <strong style="color:#1a1b25;">Deal&nbsp;&amp;&nbsp;Co</strong>.</p>
      <p style="margin:0;">Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et activer votre compte. Ce lien est valable <strong style="color:#1a1b25;">24 heures</strong>.</p>
    `,
    ctaLabel: "Confirmer mon email",
    ctaUrl: verifyUrl,
    postCta:
      "Si vous n'avez pas créé de compte sur Deal & Co, ignorez cet email.",
  });
}

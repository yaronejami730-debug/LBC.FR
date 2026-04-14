import { baseEmail } from "./base";

export function accountInvitationEmail({
  name,
  activationUrl,
}: {
  name: string;
  activationUrl: string;
}): string {
  return baseEmail({
    title: "Votre compte Deal & Co est prêt — Créez votre mot de passe",
    heading: "Votre compte est créé !",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">Un compte <strong style="color:#1a1b25;">Deal&nbsp;&amp;&nbsp;Co</strong> a été créé pour vous. Vous pouvez dès maintenant définir votre mot de passe pour accéder à votre espace.</p>
      <p style="margin:0;">Cliquez sur le bouton ci-dessous — ce lien est valable <strong style="color:#1a1b25;">7 jours</strong>.</p>
    `,
    ctaLabel: "Créer mon mot de passe",
    ctaUrl: activationUrl,
    postCta:
      "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email. Votre adresse ne sera pas utilisée sans votre confirmation.",
  });
}

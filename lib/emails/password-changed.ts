import { baseEmail } from "./base";

export function passwordChangedEmail({ name }: { name: string }): string {
  return baseEmail({
    title: "Mot de passe modifié — Deal & Co",
    heading: "Votre mot de passe a été modifié",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">Le mot de passe de votre compte <strong style="color:#1a1b25;">Deal&nbsp;&amp;&nbsp;Co</strong> vient d'être modifié avec succès.</p>
      <p style="margin:0;">Si vous n'êtes pas à l'origine de cette modification, contactez-nous immédiatement en cliquant sur le bouton ci-dessous afin de sécuriser votre compte.</p>
    `,
    ctaLabel: "Sécuriser mon compte",
    ctaUrl: "https://www.dealandcompany.fr/profile",
    postCta:
      "Si c'est bien vous qui avez effectué ce changement, vous n'avez rien d'autre à faire.",
  });
}

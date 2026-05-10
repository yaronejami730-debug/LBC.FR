import { baseEmail } from "./base";

export function verifyEmail({ name, code }: { name: string; code: string }): string {
  return baseEmail({
    title: "Confirmez votre adresse email — Deal & Co",
    heading: "Confirmez votre email",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 24px;">Voici votre code de confirmation <strong style="color:#1a1b25;">Deal&nbsp;&amp;&nbsp;Co</strong>. Il est valable <strong style="color:#1a1b25;">24 heures</strong>.</p>
      <div style="background:#f0f4ff;border-radius:16px;padding:24px;margin:0 0 24px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;color:#727782;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Code de vérification</p>
        <p style="margin:0;font-family:monospace;font-size:40px;font-weight:800;color:#1a1b25;letter-spacing:0.25em;">${code}</p>
      </div>
      <p style="margin:0;font-size:14px;color:#727782;">Entrez ce code sur la page de confirmation pour activer votre compte.</p>
    `,
    ctaLabel: "Aller à la page de confirmation",
    ctaUrl: `${process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr"}/verifier-email`,
    postCta: "Si vous n'avez pas créé de compte sur Deal & Co, ignorez cet email.",
  });
}

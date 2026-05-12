#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

const envText = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const API_KEY = env.BREVO_API_KEY;
const FROM_EMAIL = env.EMAIL_FROM || "notif@dealandcompany.fr";
const FROM_NAME = env.EMAIL_FROM_NAME || "Deal & Co";
const TO = process.argv[2] || "yaronejami26@icloud.com";
const SUBJECT = "Suite à notre échange — mise à jour de nos engagements";

if (!API_KEY) { console.error("Missing BREVO_API_KEY"); process.exit(1); }

function baseEmail({ title, heading, body, ctaLabel, ctaUrl, secondaryLabel, secondaryUrl, postCta }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@700;800&display=swap" rel="stylesheet"/>
<style>
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
body{margin:0;padding:0;background:#ffffff;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;}
img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;}
@media(max-width:620px){.wrap{width:100%!important;}.pad{padding:0 24px 28px!important;}.h1{font-size:26px!important;}.logo{width:120px!important;}}
</style>
</head>
<body bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff">
<tr><td align="center" style="padding:48px 16px;">
<table class="wrap" role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td align="center" style="padding-bottom:40px;">
    <img class="logo" src="https://www.dealandcompany.fr/logo.png" alt="Deal & Co" width="150" style="display:block;height:auto;"/>
  </td></tr>
  <tr><td align="center" style="padding-bottom:28px;">
    <h1 class="h1" style="font-family:Manrope,sans-serif;font-size:30px;font-weight:800;color:#1a1b25;letter-spacing:-0.03em;margin:0;line-height:1.25;text-align:center;">${heading}</h1>
  </td></tr>
  <tr><td class="pad" style="padding:0 8px 32px;">
    <div style="font-size:15px;color:#424751;line-height:1.75;text-align:left;">${body}</div>
  </td></tr>
  <tr><td align="center" style="padding-bottom:14px;">
    <a href="${ctaUrl}" style="display:inline-block;background:#2f6fb8;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:9999px;letter-spacing:0.01em;">${ctaLabel}</a>
  </td></tr>
  <tr><td align="center" style="padding-bottom:${postCta ? "36px" : "48px"};">
    <a href="${secondaryUrl}" style="display:inline-block;background:#ffffff;color:#2f6fb8;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:9999px;border:1.5px solid #2f6fb8;letter-spacing:0.01em;">${secondaryLabel}</a>
  </td></tr>
  ${postCta ? `<tr><td style="padding:0 8px 48px;"><p style="font-size:14px;color:#727782;line-height:1.75;margin:0;text-align:center;">${postCta}</p></td></tr>` : ""}
  <!-- SÉPARATEUR -->
  <tr><td style="padding-bottom:32px;"><div style="height:1px;background:#eceef0;"></div></td></tr>
  <tr><td align="center" style="padding-bottom:16px;">
    <img class="logo" src="https://www.dealandcompany.fr/logo.png" alt="Deal & Co" width="110" style="display:block;height:auto;margin:0 auto;opacity:0.55;"/>
  </td></tr>
  <tr><td align="center" style="padding-bottom:48px;">
    <p style="font-size:12px;color:#9ea4a9;line-height:1.7;margin:0;text-align:center;">
      Vous avez reçu cet email suite à notre échange professionnel concernant
      <a href="https://www.dealandcompany.fr" style="color:#9ea4a9;text-decoration:underline;">dealandcompany.fr</a>.<br/>
      &copy; 2026 Deal &amp; Co — Tous droits réservés.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const html = baseEmail({
  title: "Suite à notre échange — mise à jour de nos engagements",
  heading: "Suite à notre échange",
  body: `
    <p style="margin:0 0 16px;">Bonjour Monsieur,</p>
    <p style="margin:0 0 16px;">Suite à notre échange téléphonique, je me permets de revenir vers vous concernant le mail qu'il m'avait été demandé de vous transmettre.</p>
    <p style="margin:0 0 16px;">Après avoir pris le temps d'analyser vos remarques ainsi que les critiques constructives évoquées au sujet de notre plateforme, nous avons procédé à une mise à jour complète de nos <strong style="color:#1a1b25;">Conditions Générales d'Utilisation</strong> ainsi que de notre <strong style="color:#1a1b25;">Politique de Confidentialité</strong> afin de renforcer davantage la transparence et la conformité de notre service.</p>
    <p style="margin:0 0 16px;">À ce jour, nous n'avons pas changé d'hébergeur ni de fournisseur de base de données. En revanche, nous avons pris la décision de rediriger l'ensemble du traitement et du stockage des données vers des infrastructures physiquement localisées en Europe, aussi bien pour Supabase que pour Vercel.</p>
    <p style="margin:0 0 16px;">Cette évolution nous permet d'être davantage en cohérence avec les exigences évoquées lors de notre échange, notamment concernant les attentes de vos clients en matière de protection des données personnelles et de conformité au RGPD.</p>
    <p style="margin:0 0 16px;">Je comprends parfaitement les points de vigilance que vous avez soulevés hier, et avec le recul, vos remarques étaient tout à fait pertinentes. Aujourd'hui, la confiance des utilisateurs passe aussi par une gestion irréprochable des données, et nous avons souhaité prendre ce sujet avec le plus grand sérieux afin de poser des bases solides pour nos futurs partenaires.</p>
    <p style="margin:0 0 16px;">Notre objectif est de construire une collaboration durable, transparente et professionnelle, dans un cadre rassurant aussi bien pour vos équipes que pour vos clients.</p>
    <p style="margin:0 0 24px;">Je reste naturellement disponible pour échanger davantage avec vous si nécessaire, et je serais ravi de pouvoir avancer ensemble sur une future collaboration.</p>
    <p style="margin:0 0 4px;">Bien cordialement,</p>
    <p style="margin:0;"><strong style="color:#1a1b25;">Yarone</strong><br/>Deal &amp; Co<br/><a href="tel:+33783259257" style="color:#2f6fb8;text-decoration:none;">07 83 25 92 57</a><br/><a href="mailto:yaronejami26@icloud.com" style="color:#2f6fb8;text-decoration:none;">yaronejami26@icloud.com</a></p>
  `,
  ctaLabel: "Politique de confidentialité",
  ctaUrl: "https://www.dealandcompany.fr/confidentialite",
  secondaryLabel: "Conditions générales d'utilisation",
  secondaryUrl: "https://www.dealandcompany.fr/cgu",
});

const payload = {
  sender: { name: FROM_NAME, email: FROM_EMAIL },
  to: [{ email: TO }],
  subject: SUBJECT,
  htmlContent: html,
};

const res = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: { accept: "application/json", "content-type": "application/json", "api-key": API_KEY },
  body: JSON.stringify(payload),
});

const data = await res.text();
console.log("To:", TO);
console.log("Status:", res.status);
console.log("Response:", data);
if (!res.ok) process.exit(1);

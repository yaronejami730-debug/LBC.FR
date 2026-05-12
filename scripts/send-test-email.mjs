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
const TO = "yaronejami730@gmail.com";

if (!API_KEY) {
  console.error("Missing BREVO_API_KEY");
  process.exit(1);
}

function baseEmail({ title, heading, body, ctaLabel, ctaUrl, postCta, adHtml }) {
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
    @media(max-width:620px){
      .wrap{width:100%!important;}
      .pad{padding:0 24px 28px!important;}
      .h1{font-size:28px!important;}
      .logo{width:120px!important;}
    }
  </style>
</head>
<body bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff">
<tr><td align="center" style="padding:48px 16px;">
<table class="wrap" role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

  <tr><td align="center" style="padding-bottom:40px;">
    <img class="logo" src="https://www.dealandcompany.fr/logo.png"
      alt="Deal & Co" width="150" style="display:block;height:auto;"/>
  </td></tr>

  <tr><td align="center" style="padding-bottom:28px;">
    <h1 class="h1" style="font-family:Manrope,sans-serif;font-size:34px;font-weight:800;
      color:#1a1b25;letter-spacing:-0.03em;margin:0;line-height:1.2;text-align:center;">
      ${heading}
    </h1>
  </td></tr>

  <tr><td class="pad" style="padding:0 8px 32px;">
    <div style="font-size:15px;color:#424751;line-height:1.75;text-align:center;">
      ${body}
    </div>
  </td></tr>

  <tr><td align="center" style="padding-bottom:${postCta ? "36px" : "48px"};">
    <a href="${ctaUrl}"
      style="display:inline-block;background:#2f6fb8;color:#ffffff;font-size:15px;
      font-weight:700;text-decoration:none;padding:16px 40px;border-radius:9999px;
      letter-spacing:0.01em;">
      ${ctaLabel}
    </a>
  </td></tr>

  ${postCta ? `
  <tr><td style="padding:0 8px 48px;">
    <p style="font-size:14px;color:#727782;line-height:1.75;margin:0;text-align:center;">
      ${postCta}
    </p>
  </td></tr>` : ""}

  ${adHtml ?? ""}

  <!-- SÉPARATEUR -->
  <tr><td style="padding-bottom:32px;">
    <div style="height:1px;background:#eceef0;"></div>
  </td></tr>

  <tr><td align="center" style="padding-bottom:16px;">
    <img class="logo" src="https://www.dealandcompany.fr/logo.png"
      alt="Deal & Co" width="110" style="display:block;height:auto;margin:0 auto;opacity:0.55;"/>
  </td></tr>

  <tr><td align="center" style="padding-bottom:48px;">
    <p style="font-size:12px;color:#9ea4a9;line-height:1.7;margin:0;text-align:center;">
      Vous avez reçu cet email suite à votre activité sur
      <a href="https://www.dealandcompany.fr" style="color:#9ea4a9;text-decoration:underline;">dealandcompany.fr</a>.<br/>
      &copy; 2025 Deal &amp; Co — Tous droits réservés.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

const html = baseEmail({
  title: "Vous souhaitez vendre ou acheter un produit ?",
  heading: "Vous souhaitez vendre ou acheter&nbsp;un&nbsp;produit&nbsp;?",
  body: `
    <p style="margin:0 0 16px;"><strong style="color:#1a1b25;">Deal&nbsp;&amp;&nbsp;Co a la solution.</strong></p>
    <p style="margin:0;">Publiez vos annonces gratuitement et trouvez rapidement
      ce que vous recherchez, partout en France.</p>
  `,
  ctaLabel: "Découvrir Deal & Co",
  ctaUrl: "https://www.dealandcompany.fr",
  postCta:
    "Sans commission, sans intermédiaire — la marketplace de petites annonces entre particuliers.",
});

const payload = {
  sender: { name: FROM_NAME, email: FROM_EMAIL },
  to: [{ email: TO }],
  subject: "Vous souhaitez vendre ou acheter un produit ?",
  htmlContent: html,
};

const res = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/json",
    "api-key": API_KEY,
  },
  body: JSON.stringify(payload),
});

const data = await res.text();
console.log("Status:", res.status);
console.log("Response:", data);

if (!res.ok) process.exit(1);

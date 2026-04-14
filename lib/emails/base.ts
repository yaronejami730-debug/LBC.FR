/**
 * Base email layout — Deal & Co
 * Style : fond blanc, logo centré, titre centré, CTA bouton pill, footer minimaliste.
 * Responsive desktop/mobile.
 */
export function baseEmail({
  title,
  heading,
  body,
  ctaLabel,
  ctaUrl,
  postCta,
}: {
  title: string;
  heading: string;
  /** HTML autorisé : <p>, <strong>, <a> */
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  /** Texte facultatif affiché sous le bouton */
  postCta?: string;
}): string {
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

  <!-- LOGO -->
  <tr><td align="center" style="padding-bottom:40px;">
    <img class="logo" src="https://www.dealandcompany.fr/logo.png"
      alt="Deal & Co" width="150" style="display:block;height:auto;"/>
  </td></tr>

  <!-- TITRE -->
  <tr><td align="center" style="padding-bottom:28px;">
    <h1 class="h1" style="font-family:Manrope,sans-serif;font-size:34px;font-weight:800;
      color:#1a1b25;letter-spacing:-0.03em;margin:0;line-height:1.2;text-align:center;">
      ${heading}
    </h1>
  </td></tr>

  <!-- CORPS -->
  <tr><td class="pad" style="padding:0 8px 32px;">
    <div style="font-size:15px;color:#424751;line-height:1.75;text-align:center;">
      ${body}
    </div>
  </td></tr>

  <!-- CTA -->
  <tr><td align="center" style="padding-bottom:${postCta ? "36px" : "48px"};">
    <a href="${ctaUrl}"
      style="display:inline-block;background:#2f6fb8;color:#ffffff;font-size:15px;
      font-weight:700;text-decoration:none;padding:16px 40px;border-radius:9999px;
      letter-spacing:0.01em;">
      ${ctaLabel}
    </a>
  </td></tr>

  ${postCta ? `
  <!-- TEXTE POST-CTA -->
  <tr><td style="padding:0 8px 48px;">
    <p style="font-size:14px;color:#727782;line-height:1.75;margin:0;text-align:center;">
      ${postCta}
    </p>
  </td></tr>` : ""}

  <!-- SÉPARATEUR -->
  <tr><td style="padding-bottom:32px;">
    <div style="height:1px;background:#eceef0;"></div>
  </td></tr>

  <!-- FOOTER LOGO -->
  <tr><td align="center" style="padding-bottom:16px;">
    <img class="logo" src="https://www.dealandcompany.fr/logo.png"
      alt="Deal & Co" width="110" style="display:block;height:auto;margin:0 auto;opacity:0.55;"/>
  </td></tr>

  <!-- FOOTER TEXTE -->
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

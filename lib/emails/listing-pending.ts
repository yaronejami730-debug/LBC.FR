export function listingPendingEmail({
  name,
  listingTitle,
  listingUrl,
  price,
  location,
  imageUrl,
}: {
  name: string;
  listingTitle: string;
  listingUrl: string;
  price: number;
  location: string;
  imageUrl?: string;
}): string {
  const priceFormatted = price.toLocaleString("fr-FR") + " €";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Votre annonce est en cours de vérification — Deal & Co</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@700;800&display=swap" rel="stylesheet"/>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    body{margin:0;padding:0;background:#ffffff;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;}
    img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;}
    @media(max-width:620px){
      .wrap{width:100%!important;}
      .pad{padding:0 20px 24px!important;}
      .h1{font-size:26px!important;}
      .logo{width:120px!important;}
      .listing-img{height:180px!important;}
    }
  </style>
</head>
<body bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff">
<tr><td align="center" style="padding:48px 16px;">
<table class="wrap" role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

  <!-- LOGO -->
  <tr><td align="center" style="padding-bottom:40px;">
    <img class="logo" src="https://www.dealandcompany.fr/logo.png" alt="Deal & Co" width="150" style="display:block;height:auto;"/>
  </td></tr>

  <!-- BADGE -->
  <tr><td align="center" style="padding-bottom:20px;">
    <span style="display:inline-block;background:#fff8e6;color:#b45309;font-size:12px;font-weight:700;padding:6px 16px;border-radius:9999px;border:1px solid #fde68a;letter-spacing:0.05em;text-transform:uppercase;">
      En cours de vérification
    </span>
  </td></tr>

  <!-- TITRE -->
  <tr><td align="center" style="padding-bottom:28px;">
    <h1 class="h1" style="font-family:Manrope,sans-serif;font-size:32px;font-weight:800;color:#1a1b25;letter-spacing:-0.03em;margin:0;line-height:1.2;text-align:center;">
      Annonce reçue, en attente d'approbation
    </h1>
  </td></tr>

  <!-- CORPS -->
  <tr><td class="pad" style="padding:0 8px 28px;">
    <p style="font-size:15px;color:#424751;line-height:1.75;margin:0;text-align:center;">
      Bonjour <strong style="color:#1a1b25;">${name}</strong>, votre annonce a bien été reçue et est actuellement examinée par notre équipe. Elle sera publiée dès validation, généralement sous <strong style="color:#1a1b25;">24 à 48 h</strong>.
    </p>
  </td></tr>

  <!-- CARD ANNONCE -->
  <tr><td style="padding:0 8px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="border:1px solid #eceef0;border-radius:16px;overflow:hidden;">

      ${imageUrl ? `
      <!-- IMAGE -->
      <tr><td style="padding:0;">
        <img class="listing-img" src="${imageUrl}" alt="${listingTitle}"
          style="display:block;width:100%;height:220px;object-fit:cover;border-radius:16px 16px 0 0;opacity:0.85;"/>
      </td></tr>` : ""}

      <!-- INFOS -->
      <tr><td style="padding:20px 24px;">
        <p style="font-family:Manrope,sans-serif;font-size:18px;font-weight:800;color:#1a1b25;margin:0 0 8px;line-height:1.3;">
          ${listingTitle}
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:16px;">
            <p style="font-size:22px;font-weight:800;color:#2f6fb8;margin:0;">${priceFormatted}</p>
          </td>
          <td style="border-left:1px solid #eceef0;padding-left:16px;">
            <p style="font-size:13px;color:#727782;margin:0;">${location}</p>
          </td>
        </tr></table>
      </td></tr>

      <!-- CTA -->
      <tr><td style="padding:0 24px 24px;">
        <a href="${listingUrl}"
          style="display:block;background:#f1f5f9;color:#424751;
          text-align:center;padding:14px 32px;font-weight:700;font-size:14px;
          border-radius:9999px;text-decoration:none;">
          Aperçu de mon annonce
        </a>
      </td></tr>
    </table>
  </td></tr>

  <!-- INFO -->
  <tr><td style="padding:0 8px 48px;">
    <p style="font-size:13px;color:#727782;line-height:1.75;margin:0;text-align:center;">
      Vous recevrez un email de confirmation dès que votre annonce sera en ligne. Si elle ne respecte pas nos conditions d'utilisation, elle pourra être refusée.
    </p>
  </td></tr>

  <!-- SÉPARATEUR -->
  <tr><td style="padding-bottom:32px;">
    <div style="height:1px;background:#eceef0;"></div>
  </td></tr>

  <!-- FOOTER LOGO -->
  <tr><td align="center" style="padding-bottom:16px;">
    <img class="logo" src="https://www.dealandcompany.fr/logo.png" alt="Deal & Co" width="110"
      style="display:block;height:auto;margin:0 auto;opacity:0.55;"/>
  </td></tr>

  <tr><td align="center" style="padding-bottom:48px;">
    <p style="font-size:12px;color:#9ea4a9;line-height:1.7;margin:0;text-align:center;">
      Vous avez reçu cet email car vous venez de déposer une annonce sur
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

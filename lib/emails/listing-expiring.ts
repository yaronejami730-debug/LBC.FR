export function listingExpiringEmail({
  name,
  listingTitle,
  listingUrl,
  republishUrl,
  imageUrl,
  price,
}: {
  name: string;
  listingTitle: string;
  listingUrl: string;
  republishUrl: string;
  imageUrl?: string;
  price: number;
}): string {
  const priceFormatted = price.toLocaleString("fr-FR") + " €";
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Votre annonce expire bientôt — Deal & Co</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@700;800&display=swap" rel="stylesheet"/>
<style>body,table,td,a{-webkit-text-size-adjust:100%;}body{margin:0;padding:0;background:#ffffff;font-family:Inter,-apple-system,sans-serif;}@media(max-width:620px){.wrap{width:100%!important;}.pad{padding:0 20px 24px!important;}.h1{font-size:26px!important;}.logo{width:120px!important;}}</style>
</head><body bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff">
<tr><td align="center" style="padding:48px 16px;">
<table class="wrap" role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td align="center" style="padding-bottom:40px;"><img class="logo" src="https://www.dealandcompany.fr/logo.png" alt="Deal & Co" width="150" style="display:block;height:auto;"/></td></tr>
  <tr><td align="center" style="padding-bottom:28px;">
    <h1 class="h1" style="font-family:Manrope,sans-serif;font-size:32px;font-weight:800;color:#1a1b25;letter-spacing:-0.03em;margin:0;line-height:1.2;text-align:center;">Votre annonce expire dans 48h</h1>
  </td></tr>
  <tr><td class="pad" style="padding:0 8px 28px;">
    <p style="font-size:15px;color:#424751;line-height:1.75;margin:0 0 16px;text-align:center;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
    <p style="font-size:15px;color:#424751;line-height:1.75;margin:0;text-align:center;">Votre annonce <strong style="color:#1a1b25;">« ${listingTitle} »</strong> a atteint sa durée de vie de <strong>90 jours</strong> sur Deal&nbsp;&amp;&nbsp;Co. Elle sera automatiquement retirée du site dans <strong>48 heures</strong>.</p>
  </td></tr>
  ${imageUrl ? `
  <tr><td style="padding:0 8px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eceef0;border-radius:16px;overflow:hidden;">
      <tr><td><img src="${imageUrl}" alt="${listingTitle}" style="display:block;width:100%;height:200px;object-fit:cover;border-radius:16px 16px 0 0;"/></td></tr>
      <tr><td style="padding:16px 20px;">
        <p style="font-family:Manrope,sans-serif;font-size:16px;font-weight:800;color:#1a1b25;margin:0 0 4px;">${listingTitle}</p>
        <p style="font-size:18px;font-weight:800;color:#2f6fb8;margin:0;">${priceFormatted}</p>
      </td></tr>
    </table>
  </td></tr>` : ""}
  <tr><td align="center" style="padding-bottom:20px;">
    <a href="${republishUrl}" style="display:inline-block;background:linear-gradient(135deg,#00569e,#2f6fb8);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:9999px;">Republier mon annonce</a>
  </td></tr>
  <tr><td style="padding:0 8px 48px;">
    <p style="font-size:13px;color:#727782;line-height:1.75;margin:0;text-align:center;">Si vous ne souhaitez plus republier cette annonce, ignorez cet email. Elle sera définitivement supprimée de nos serveurs dans 48h.</p>
  </td></tr>
  <tr><td style="padding-bottom:32px;"><div style="height:1px;background:#eceef0;"></div></td></tr>
  <tr><td align="center" style="padding-bottom:16px;"><img class="logo" src="https://www.dealandcompany.fr/logo.png" alt="Deal & Co" width="110" style="display:block;height:auto;margin:0 auto;opacity:0.55;"/></td></tr>
  <tr><td align="center" style="padding-bottom:48px;"><p style="font-size:12px;color:#9ea4a9;line-height:1.7;margin:0;text-align:center;">© 2025 Deal &amp; Co — <a href="https://www.dealandcompany.fr" style="color:#9ea4a9;text-decoration:underline;">dealandcompany.fr</a></p></td></tr>
</table></td></tr></table>
</body></html>`;
}

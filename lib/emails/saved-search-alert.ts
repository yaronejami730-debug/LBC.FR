const BASE = "https://www.dealandcompany.fr";

interface AlertListing {
  id: string;
  title: string;
  price: number;
  location: string;
  imageUrl?: string;
  url: string;
}

export function savedSearchAlertEmail({
  name,
  searchName,
  searchUrl,
  listings,
  manageUrl,
}: {
  name: string;
  searchName: string;
  searchUrl: string;
  listings: AlertListing[];
  manageUrl: string;
}): string {
  const count = listings.length;
  const plural = count > 1;

  const listingCards = listings
    .slice(0, 10)
    .map(
      (l) => `
    <tr>
      <td style="padding:0 0 12px 0;">
        <a href="${l.url}" style="display:block;text-decoration:none;border:1px solid #eceef0;border-radius:14px;overflow:hidden;background:#fff;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${l.imageUrl ? `<td width="88" style="padding:0;vertical-align:middle;">
                <img src="${l.imageUrl}" alt="${l.title.replace(/"/g, "&quot;")}"
                  width="88" height="88"
                  style="display:block;width:88px;height:88px;object-fit:cover;border-radius:13px 0 0 13px;"/>
              </td>` : ""}
              <td style="padding:12px 16px;vertical-align:middle;">
                <p style="margin:0 0 4px 0;font-size:14px;font-weight:600;color:#1a1b25;line-height:1.3;
                  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">
                  ${l.title}
                </p>
                <p style="margin:0 0 4px 0;font-size:16px;font-weight:700;color:#2f6fb8;">
                  ${l.price.toLocaleString("fr-FR")} €
                </p>
                <p style="margin:0;font-size:12px;color:#9ea4a9;">${l.location}</p>
              </td>
            </tr>
          </table>
        </a>
      </td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Nouvelles annonces — Deal &amp; Co</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@700;800&display=swap" rel="stylesheet"/>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    body{margin:0;padding:0;background:#ffffff;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;}
    img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;}
    @media(max-width:620px){.wrap{width:100%!important;}.pad{padding:0 16px 28px!important;}.h1{font-size:26px!important;}}
  </style>
</head>
<body bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff">
<tr><td align="center" style="padding:48px 16px;">
<table class="wrap" role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

  <!-- LOGO -->
  <tr><td align="center" style="padding-bottom:32px;">
    <img src="${BASE}/logo.png" alt="Deal &amp; Co" width="140" style="display:block;height:auto;"/>
  </td></tr>

  <!-- TITRE -->
  <tr><td align="center" style="padding-bottom:8px;">
    <h1 class="h1" style="font-family:Manrope,sans-serif;font-size:30px;font-weight:800;
      color:#1a1b25;letter-spacing:-0.03em;margin:0;line-height:1.2;text-align:center;">
      ${count} nouvelle${plural ? "s" : ""} annonce${plural ? "s" : ""}
    </h1>
  </td></tr>

  <!-- SOUS-TITRE -->
  <tr><td align="center" style="padding-bottom:28px;">
    <p style="font-size:15px;color:#727782;margin:0;text-align:center;">
      Pour votre alerte &laquo;&nbsp;<strong style="color:#1a1b25;">${searchName}</strong>&nbsp;&raquo;
    </p>
  </td></tr>

  <!-- LISTINGS -->
  <tr><td class="pad" style="padding:0 8px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${listingCards}
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td align="center" style="padding-bottom:40px;">
    <a href="${searchUrl}"
      style="display:inline-block;background:#2f6fb8;color:#ffffff;font-size:15px;
      font-weight:700;text-decoration:none;padding:16px 40px;border-radius:9999px;
      letter-spacing:0.01em;">
      Voir toutes les annonces
    </a>
  </td></tr>

  <!-- SÉPARATEUR -->
  <tr><td style="padding-bottom:32px;">
    <div style="height:1px;background:#eceef0;"></div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td align="center" style="padding-bottom:48px;">
    <p style="font-size:12px;color:#9ea4a9;line-height:1.7;margin:0;text-align:center;">
      Vous recevez cet email car vous avez créé une alerte sur
      <a href="${BASE}" style="color:#9ea4a9;text-decoration:underline;">dealandcompany.fr</a>.<br/>
      <a href="${manageUrl}" style="color:#9ea4a9;text-decoration:underline;">Gérer mes alertes</a>
      &nbsp;·&nbsp;
      &copy; 2025 Deal &amp; Co
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

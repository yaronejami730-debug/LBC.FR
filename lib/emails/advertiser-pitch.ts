/**
 * Email de démarchage annonceur — proposition de campagne à 25 € / jour.
 *
 * Mise en page volontairement différente du reste des emails : beaucoup de
 * blanc, un titre qui respire, des accents de couleur et un seul bouton. Un
 * email de prospection n'a que quelques secondes pour donner envie — il ne
 * ressemble donc pas à une notification.
 *
 * Prospection B2B (LCEN) : autorisée vers une adresse professionnelle si le
 * message concerne l'activité du destinataire. Opt-out inclus.
 */

const BLUE = "#2f6fb8";
const INK = "#1a1b25";
const GREY = "#5b616e";

/** Une carte-argument : pastille de couleur, titre, une phrase. */
function feature(color: string, emoji: string, title: string, text: string): string {
  return `
  <tr><td style="padding:0 0 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:#f7f9fc;border-radius:16px;">
      <tr>
        <td width="64" valign="top" style="padding:20px 0 20px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td align="center" valign="middle" width="44" height="44"
              style="width:44px;height:44px;background:${color};border-radius:22px;font-size:20px;line-height:44px;">
              ${emoji}
            </td></tr>
          </table>
        </td>
        <td valign="middle" style="padding:20px 20px 20px 14px;">
          <div style="font-size:16px;font-weight:700;color:${INK};line-height:1.35;">${title}</div>
          <div style="font-size:14px;color:${GREY};line-height:1.6;margin-top:3px;">${text}</div>
        </td>
      </tr>
    </table>
  </td></tr>`;
}

export function advertiserPitchEmail({
  firstName,
  companyName,
  dailyBudgetEuros = 25,
  phone = "07 83 25 91 57",
  baseUrl,
}: {
  firstName: string;
  companyName?: string;
  dailyBudgetEuros?: number;
  /** Numéro affiché au prospect qui préfère appeler. */
  phone?: string;
  baseUrl: string;
}): { subject: string; html: string } {
  const enseigne = companyName?.trim();
  const subject = `${firstName}, et si vos futurs clients vous voyaient demain ?`;
  const ctaUrl = `${baseUrl}/#annonceurs`;
  const telHref = `tel:+33${phone.replace(/\D/g, "").replace(/^0/, "")}`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${subject}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@700;800&display=swap" rel="stylesheet"/>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    body{margin:0;padding:0;background:#ffffff;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;}
    img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;}
    @media(max-width:620px){
      .wrap{width:100%!important;}
      .pad{padding-left:24px!important;padding-right:24px!important;}
      .h1{font-size:34px!important;}
      .price{font-size:56px!important;}
    }
  </style>
</head>
<body bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff">
<tr><td align="center" style="padding:44px 16px 56px;">
<table class="wrap" role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

  <!-- LOGO -->
  <tr><td class="pad" style="padding-bottom:36px;">
    <img src="https://www.dealandcompany.fr/logo.png" alt="Deal &amp; Co" width="132"
      style="display:block;height:auto;"/>
  </td></tr>

  <!-- ACCENT 4 COULEURS -->
  <tr><td class="pad" style="padding-bottom:22px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td width="34" height="5" style="background:${BLUE};border-radius:3px;font-size:0;line-height:5px;">&nbsp;</td>
      <td width="8" style="font-size:0;">&nbsp;</td>
      <td width="20" height="5" style="background:#e8544a;border-radius:3px;font-size:0;line-height:5px;">&nbsp;</td>
      <td width="8" style="font-size:0;">&nbsp;</td>
      <td width="20" height="5" style="background:#f5b544;border-radius:3px;font-size:0;line-height:5px;">&nbsp;</td>
      <td width="8" style="font-size:0;">&nbsp;</td>
      <td width="20" height="5" style="background:#2fa05a;border-radius:3px;font-size:0;line-height:5px;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <!-- TITRE -->
  <tr><td class="pad" style="padding-bottom:18px;">
    <h1 class="h1" style="font-family:Manrope,sans-serif;font-size:40px;font-weight:800;color:${INK};
      letter-spacing:-0.035em;margin:0;line-height:1.1;">
      Bonjour ${firstName},<br/>vos clients sont déjà là.
    </h1>
  </td></tr>

  <tr><td class="pad" style="padding-bottom:32px;">
    <p style="margin:0;font-size:16px;color:${GREY};line-height:1.7;">
      Chaque jour, des gens cherchent près de chez vous sur Deal&nbsp;&amp;&nbsp;Co.
      ${enseigne ? `Il ne manque qu'une chose&nbsp;: que <strong style="color:${INK};">${enseigne}</strong> leur passe sous les yeux au bon moment.` : `Il ne manque qu'une chose&nbsp;: que votre annonce leur passe sous les yeux au bon moment.`}
    </p>
  </td></tr>

  <!-- PRIX -->
  <tr><td class="pad" style="padding-bottom:34px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:#f2f7fd;border-radius:20px;">
      <tr><td align="center" style="padding:30px 24px 28px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:${BLUE};">
          À partir de
        </div>
        <div class="price" style="font-family:Manrope,sans-serif;font-size:64px;font-weight:800;color:${INK};
          letter-spacing:-0.04em;line-height:1.05;margin:6px 0 2px;">
          ${dailyBudgetEuros}&nbsp;€
        </div>
        <div style="font-size:15px;font-weight:600;color:${GREY};">par jour</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- COMMENT MARCHE LE BUDGET -->
  <tr><td class="pad" style="padding-bottom:34px;">
    <p style="margin:0;font-size:15px;color:${GREY};line-height:1.75;">
      Le principe est simple&nbsp;: vous fixez ce que vous voulez dépenser par jour. À
      <strong style="color:${INK};">${dailyBudgetEuros}&nbsp;€</strong>, votre publicité tourne
      jusqu'à ce que ce budget soit atteint, puis elle repart le lendemain. Rien n'est prélevé
      au-delà. Vous montez, vous baissez ou vous mettez en pause quand ça vous arrange.
    </p>
  </td></tr>

  <!-- ARGUMENTS -->
  <tr><td class="pad" style="padding-bottom:22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${feature("#e8f0fb", "📍", "Des gens d'à côté", "Votre publicité s'affiche auprès des visiteurs de votre zone.")}
      ${feature("#fdecea", "🎯", "Au bon moment", "Vous apparaissez dans les catégories où votre activité a du sens.")}
      ${feature("#fef5e3", "📊", "Vous voyez tout", "Impressions et clics, jour par jour. Rien d'opaque.")}
      ${feature("#e9f6ee", "🎛️", "Vous gardez la main", "Coupez, relancez, changez le budget quand vous voulez.")}
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td class="pad" align="center" style="padding:14px 24px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td align="center" bgcolor="${BLUE}" style="border-radius:999px;">
        <a href="${ctaUrl}" target="_blank"
          style="display:inline-block;padding:17px 42px;font-size:16px;font-weight:700;color:#ffffff;
          text-decoration:none;border-radius:999px;letter-spacing:-0.01em;">
          Essayer ${dailyBudgetEuros} € par jour
        </a>
      </td>
    </tr></table>
  </td></tr>

  <!-- RASSURANCE -->
  <tr><td class="pad" align="center" style="padding-bottom:34px;">
    <p style="margin:0;font-size:14px;color:${GREY};line-height:1.7;">
      <strong style="color:${INK};">Commencez par tester.</strong> Quelques jours suffisent pour voir
      ce que ça donne.<br/>Sans engagement, sans abonnement, vous arrêtez quand vous voulez.
    </p>
  </td></tr>

  <!-- TÉLÉPHONE -->
  <tr><td class="pad" align="center" style="padding-bottom:34px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:#f7f9fc;border-radius:16px;">
      <tr><td align="center" style="padding:20px 24px;">
        <div style="font-size:14px;color:${GREY};line-height:1.6;">
          Vous préférez qu'on en parle de vive voix&nbsp;?
        </div>
        <a href="${telHref}" style="display:inline-block;margin-top:6px;font-family:Manrope,sans-serif;
          font-size:24px;font-weight:800;color:${BLUE};text-decoration:none;letter-spacing:-0.02em;">
          ${phone}
        </a>
      </td></tr>
    </table>
  </td></tr>

  <!-- MOT DE FIN -->
  <tr><td class="pad" style="padding-bottom:30px;">
    <p style="margin:0;font-size:15px;color:${GREY};line-height:1.75;">
      Si la publicité vous intéresse, n'hésitez pas&nbsp;: appelez-nous au
      <a href="${telHref}" style="color:${BLUE};font-weight:700;text-decoration:none;">${phone}</a>
      ou répondez simplement à cet email. On monte la campagne avec vous.<br/><br/>
      À très vite,<br/><strong style="color:${INK};">L'équipe Deal&nbsp;&amp;&nbsp;Co</strong>
    </p>
  </td></tr>

  <!-- SÉPARATEUR -->
  <tr><td class="pad" style="padding-bottom:18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td height="1" style="background:#eceef0;font-size:0;line-height:1px;">&nbsp;</td></tr>
    </table>
  </td></tr>

  <tr><td class="pad">
    <p style="margin:0;font-size:12px;color:#9aa1ad;line-height:1.7;">
      Vous recevez cet email à titre professionnel. Pour ne plus être contacté, répondez «&nbsp;STOP&nbsp;».<br/>
      <a href="${baseUrl}" style="color:#9aa1ad;text-decoration:underline;">dealandcompany.fr</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}

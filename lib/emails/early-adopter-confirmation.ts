const BASE_URL = "https://www.dealandcompany.fr";

export function earlyAdopterConfirmationEmail({
  firstName,
  companyName,
  position,
}: {
  firstName: string;
  companyName: string;
  position: number;
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Votre place fondateur est réservée — Deal & Co</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@700;800&display=swap" rel="stylesheet"/>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    body{margin:0;padding:0;background:#ffffff;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;}
    img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;}
    @media(max-width:620px){
      .wrap{width:100%!important;}
      .pad{padding:0 20px 24px!important;}
      .h1{font-size:26px!important;}
      .logo{width:110px!important;}
    }
  </style>
</head>
<body bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff">
<tr><td align="center" style="padding:48px 16px;">
<table class="wrap" role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

  <!-- LOGO -->
  <tr><td align="center" style="padding-bottom:36px;">
    <img class="logo" src="${BASE_URL}/logo.png" alt="Deal & Co" width="140" style="display:block;height:auto;"/>
  </td></tr>

  <!-- BADGE -->
  <tr><td align="center" style="padding-bottom:20px;">
    <span style="display:inline-block;background:#fbbf24;color:#1a1b25;font-size:12px;font-weight:800;
      letter-spacing:0.12em;text-transform:uppercase;padding:6px 18px;border-radius:9999px;">
      🎯 Offre Fondateur — Place n°${position} / 50
    </span>
  </td></tr>

  <!-- TITRE -->
  <tr><td align="center" style="padding-bottom:20px;">
    <h1 class="h1" style="font-family:Manrope,sans-serif;font-size:32px;font-weight:800;
      color:#1a1b25;letter-spacing:-0.03em;margin:0;line-height:1.2;text-align:center;">
      Votre place est réservée,<br/>${firstName}&nbsp;!
    </h1>
  </td></tr>

  <!-- INTRO -->
  <tr><td class="pad" style="padding:0 8px 28px;">
    <div style="font-size:15px;color:#424751;line-height:1.75;text-align:center;">
      <p style="margin:0;">
        Félicitations — <strong style="color:#1a1b25;">${companyName}</strong> fait désormais partie
        des <strong style="color:#1a1b25;">50 premiers partenaires professionnels</strong> de Deal&nbsp;&amp;&nbsp;Co.
        Votre place est confirmée et votre réduction de <strong style="color:#1a1b25;">−50% pendant 3 ans</strong>
        est bien réservée à votre nom.
      </p>
    </div>
  </td></tr>

  <!-- ALERTE COMPTE -->
  <tr><td style="padding:0 0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:#fff8e6;border:2px solid #fbbf24;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:800;color:#b45309;text-transform:uppercase;letter-spacing:0.1em;">
            ⚠️ Important — Votre compte n'est pas encore créé
          </p>
          <p style="margin:0;font-size:14px;color:#78350f;line-height:1.65;">
            Cette pré-inscription ne crée pas votre compte Deal&nbsp;&amp;&nbsp;Co.
            Pour bénéficier de votre réduction, vous devez <strong>créer votre compte avec exactement cette adresse email</strong>.
            La réduction sera appliquée automatiquement à la création.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CTA CRÉER COMPTE -->
  <tr><td align="center" style="padding-bottom:36px;">
    <a href="${BASE_URL}/register"
      style="display:inline-block;background:#2f6fb8;color:#ffffff;font-size:15px;
      font-weight:700;text-decoration:none;padding:16px 44px;border-radius:9999px;
      letter-spacing:0.01em;">
      Créer mon compte maintenant →
    </a>
  </td></tr>

  <!-- COMMENT ÇA MARCHE -->
  <tr><td style="padding:0 0 12px;">
    <p style="margin:0;font-size:13px;font-weight:800;color:#1a1b25;text-transform:uppercase;letter-spacing:0.1em;">
      Comment fonctionne Deal & Co ?
    </p>
  </td></tr>

  <tr><td style="padding:0 0 10px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:#f7f9fb;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:18px 22px;">
        <p style="margin:0 0 5px;font-size:12px;font-weight:700;color:#2f6fb8;text-transform:uppercase;letter-spacing:0.1em;">
          Les annonces : gratuites, toujours
        </p>
        <p style="margin:0;font-size:14px;color:#424751;line-height:1.65;">
          Publier des annonces sur Deal&nbsp;&amp;&nbsp;Co est et restera <strong style="color:#1a1b25;">entièrement gratuit</strong>,
          sans limite, sans abonnement, sans commission sur vos ventes.
          C'est notre engagement envers tous nos utilisateurs, pros comme particuliers.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 0 10px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:#f7f9fb;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:18px 22px;">
        <p style="margin:0 0 5px;font-size:12px;font-weight:700;color:#2f6fb8;text-transform:uppercase;letter-spacing:0.1em;">
          Notre modèle économique : la publicité
        </p>
        <p style="margin:0;font-size:14px;color:#424751;line-height:1.65;">
          Deal&nbsp;&amp;&nbsp;Co se rémunère uniquement via des <strong style="color:#1a1b25;">espaces publicitaires</strong> :
          bannières visibles par des milliers d'utilisateurs locaux, annonces mises en avant en tête de liste.
          Ce modèle nous permet de garder la plateforme gratuite pour tout le monde,
          tout en offrant aux professionnels une visibilité premium s'ils le souhaitent.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:#f7f9fb;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:18px 22px;">
        <p style="margin:0 0 5px;font-size:12px;font-weight:700;color:#2f6fb8;text-transform:uppercase;letter-spacing:0.1em;">
          Votre avantage Fondateur — −50% pendant 3 ans
        </p>
        <p style="margin:0;font-size:14px;color:#424751;line-height:1.65;">
          En tant que partenaire fondateur, tous nos forfaits publicitaires
          (bannières, mise en avant d'annonces, sponsoring de catégorie) vous seront proposés
          avec <strong style="color:#1a1b25;">50% de réduction pendant 3 ans</strong> dès leur lancement.
          Aucune action requise de votre part — il suffit de créer votre compte avec cette adresse email.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <!-- NOTE DISCRÈTE mise en avant -->
  <tr><td style="padding:0 0 36px;">
    <p style="font-size:12px;color:#9ea4a9;line-height:1.7;margin:0;text-align:center;font-style:italic;">
      À noter : certains services optionnels comme la mise en avant d'annonces individuelles
      ou les boosts ponctuels restent des fonctionnalités payantes à la carte,
      indépendantes des forfaits publicitaires couverts par votre réduction fondateur.
    </p>
  </td></tr>

  <!-- SÉPARATEUR -->
  <tr><td style="padding-bottom:32px;">
    <div style="height:1px;background:#eceef0;"></div>
  </td></tr>

  <!-- FOOTER LOGO -->
  <tr><td align="center" style="padding-bottom:16px;">
    <img class="logo" src="${BASE_URL}/logo.png"
      alt="Deal & Co" width="100" style="display:block;height:auto;margin:0 auto;opacity:0.5;"/>
  </td></tr>

  <!-- FOOTER TEXTE -->
  <tr><td align="center" style="padding-bottom:48px;">
    <p style="font-size:12px;color:#9ea4a9;line-height:1.7;margin:0;text-align:center;">
      Vous recevez cet email car vous avez rejoint l'offre fondateur Deal&nbsp;&amp;&nbsp;Co.<br/>
      <a href="${BASE_URL}" style="color:#9ea4a9;text-decoration:underline;">dealandcompany.fr</a>
      &nbsp;·&nbsp; &copy; 2025 Deal &amp; Co — Tous droits réservés.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

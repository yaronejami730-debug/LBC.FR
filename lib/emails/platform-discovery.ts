const BASE_URL = "https://www.dealandcompany.fr";

type TargetType = "tous" | "pro" | "particulier";

const DOMAIN_LABELS: Record<string, string> = {
  immobilier: "l'immobilier",
  vehicules: "l'automobile",
  electronique: "l'électronique et le high-tech",
  mode: "la mode et l'habillement",
  services: "les services",
  emploi: "l'emploi et le recrutement",
  maison: "la maison et la décoration",
  animaux: "les animaux de compagnie",
  loisirs: "les loisirs et les sports",
};

function getSubject(target: TargetType, domain: string): string {
  const label = DOMAIN_LABELS[domain];
  if (target === "pro" && label) return `Développez votre activité dans ${label} — 100% gratuit sur Deal & Co`;
  if (target === "pro") return "Publiez gratuitement vos annonces professionnelles — Deal & Co";
  if (target === "particulier" && label) return `Trouvez votre bonheur dans ${label} — Deal & Co`;
  if (label) return `Découvrez Deal & Co — ${label.charAt(0).toUpperCase() + label.slice(1)} et bien plus`;
  return "Découvrez Deal & Co — La marketplace locale 100% gratuite";
}

function getHeading(target: TargetType): string {
  if (target === "pro") return "La marketplace des\u00a0professionnels";
  if (target === "particulier") return "Achetez, vendez,\u00a0échangez !";
  return "Bienvenue sur Deal\u00a0& Co";
}

function getIntro(target: TargetType, domain: string): string {
  const label = DOMAIN_LABELS[domain];

  if (target === "pro" && label) {
    return `En tant que professionnel dans <strong style="color:#1a1b25;">${label}</strong>, vous savez combien la visibilité locale est essentielle. <strong style="color:#1a1b25;">Deal&nbsp;&amp;&nbsp;Co</strong> vous offre une vitrine digitale pour atteindre des clients qualifiés près de chez vous — avec <strong style="color:#1a1b25;">zéro commission</strong> et <strong style="color:#1a1b25;">zéro paiement</strong>. Publier une annonce est entièrement gratuit.`;
  }
  if (target === "pro") {
    return `<strong style="color:#1a1b25;">Deal&nbsp;&amp;&nbsp;Co</strong> est la marketplace locale conçue pour les professionnels. Publiez vos offres, touchez une clientèle qualifiée dans votre région — <strong style="color:#1a1b25;">zéro commission, zéro frais, 100% gratuit</strong>.`;
  }
  if (target === "particulier" && label) {
    return `Que vous souhaitiez vendre, acheter ou trouver une bonne affaire dans <strong style="color:#1a1b25;">${label}</strong>, <strong style="color:#1a1b25;">Deal&nbsp;&amp;&nbsp;Co</strong> est la plateforme idéale — <strong style="color:#1a1b25;">entièrement gratuite</strong>, sans paiement ni commission.`;
  }
  if (target === "particulier") {
    return `Avec <strong style="color:#1a1b25;">Deal&nbsp;&amp;&nbsp;Co</strong>, publiez une annonce en 2 minutes, trouvez des acheteurs près de chez vous — <strong style="color:#1a1b25;">gratuitement, sans commission, sans paiement</strong>.`;
  }
  if (label) {
    return `Nous souhaitons vous faire découvrir <strong style="color:#1a1b25;">Deal&nbsp;&amp;&nbsp;Co</strong>, la marketplace locale spécialisée notamment dans <strong style="color:#1a1b25;">${label}</strong>. Publiez et parcourez des annonces <strong style="color:#1a1b25;">100% gratuitement</strong> — aucun paiement, aucune commission.`;
  }
  return `Nous souhaitons vous faire découvrir <strong style="color:#1a1b25;">Deal&nbsp;&amp;&nbsp;Co</strong>, la marketplace locale pour acheter, vendre et échanger près de chez vous — <strong style="color:#1a1b25;">entièrement gratuite</strong>, sans commission ni paiement.`;
}

function getFeatures(target: TargetType) {
  if (target === "pro") {
    return [
      {
        label: "100% gratuit — zéro commission",
        desc: "Publiez autant d'annonces que vous voulez. Aucun abonnement, aucune commission sur vos ventes, aucun paiement. Jamais.",
      },
      {
        label: "Visibilité locale & badge Pro",
        desc: "Touchez des milliers de clients qualifiés dans votre région. Démarquez-vous avec un profil professionnel vérifié et un badge Pro.",
      },
      {
        label: "Simple, rapide, sans contrainte",
        desc: "Créez votre annonce en 2 minutes — photos, prix, description. Votre vitrine en ligne, sans intermédiaire.",
      },
    ];
  }
  if (target === "particulier") {
    return [
      {
        label: "100% gratuit — sans paiement",
        desc: "Publiez vos annonces gratuitement. Aucune commission sur vos ventes, aucun frais caché. C'est vraiment gratuit.",
      },
      {
        label: "Des bonnes affaires près de chez vous",
        desc: "Achetez et vendez localement — sans frais de livraison, en rencontrant directement l'acheteur.",
      },
      {
        label: "Une communauté de confiance",
        desc: "Profils vérifiés, messagerie intégrée et avis transparents pour des échanges en toute sérénité.",
      },
    ];
  }
  return [
    {
      label: "100% gratuit pour tous",
      desc: "Pros comme particuliers, publiez autant d'annonces que vous voulez. Aucun paiement, aucune commission, aucun frais caché.",
    },
    {
      label: "Achetez & vendez localement",
      desc: "Trouvez des annonces près de chez vous — immobilier, véhicules, électronique, emploi et bien plus encore.",
    },
    {
      label: "Une communauté de confiance",
      desc: "Vendeurs vérifiés, messagerie intégrée et profils détaillés pour des échanges en toute sécurité.",
    },
  ];
}

export function platformDiscoveryEmail({
  target,
  domain,
}: {
  target: TargetType;
  domain: string;
}): { subject: string; html: string } {
  const subject = getSubject(target, domain);
  const heading = getHeading(target);
  const intro = getIntro(target, domain);
  const features = getFeatures(target);

  const featuresHtml = features
    .map(
      (f) => `
    <tr>
      <td style="padding:0 0 10px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#f7f9fb;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:18px 22px;">
              <p style="margin:0 0 5px;font-size:12px;font-weight:700;color:#2f6fb8;text-transform:uppercase;letter-spacing:0.1em;">${f.label}</p>
              <p style="margin:0;font-size:14px;color:#424751;line-height:1.65;">${f.desc}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    )
    .join("");

  // Bloc offre early adopter — uniquement pour les pros
  const earlyAdopterHtml = target === "pro" ? `
  <!-- OFFRE EARLY ADOPTER -->
  <tr><td style="padding:0 0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:linear-gradient(135deg,#1a1b25 0%,#2f3a5c 100%);border-radius:20px;overflow:hidden;">
      <tr>
        <td style="padding:28px 28px 24px;">
          <!-- Badge -->
          <p style="margin:0 0 14px;">
            <span style="display:inline-block;background:#2f6fb8;color:#ffffff;font-size:11px;font-weight:800;
              letter-spacing:0.12em;text-transform:uppercase;padding:5px 14px;border-radius:9999px;">
              Offre fondateurs — 50 premiers pros
            </span>
          </p>
          <!-- Titre -->
          <p style="margin:0 0 10px;font-family:Manrope,sans-serif;font-size:22px;font-weight:800;
            color:#ffffff;line-height:1.25;">
            −50% sur vos publicités,<br/>pendant 3 ans.
          </p>
          <!-- Explication -->
          <p style="margin:0 0 20px;font-size:14px;color:#b0b8cc;line-height:1.7;">
            Deal &amp; Co se développe et nous comptons sur nos premiers partenaires professionnels.
            Notre modèle : <strong style="color:#ffffff;">les annonces restent gratuites pour toujours.</strong>
            Nous nous rémunérons uniquement via des <strong style="color:#ffffff;">espaces publicitaires</strong>
            (bannières, annonces sponsorisées) visibles par des milliers d'utilisateurs locaux.<br/><br/>
            En vous inscrivant parmi nos <strong style="color:#ffffff;">50 premiers clients professionnels</strong>,
            vous bénéficiez pendant 3 ans d'une réduction de <strong style="color:#fbbf24;">−50%</strong> sur
            tous vos forfaits publicitaires — dès leur lancement.
          </p>
          <!-- CTA offre -->
          <a href="${BASE_URL}/early-adopter"
            style="display:inline-block;background:#fbbf24;color:#1a1b25;font-size:14px;
            font-weight:800;text-decoration:none;padding:14px 32px;border-radius:9999px;
            letter-spacing:0.01em;">
            Je réserve ma place →
          </a>
        </td>
      </tr>
    </table>
  </td></tr>` : "";

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
      .pad{padding:0 24px 28px!important;}
      .h1{font-size:26px!important;}
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
  <tr><td align="center" style="padding-bottom:24px;">
    <h1 class="h1" style="font-family:Manrope,sans-serif;font-size:34px;font-weight:800;
      color:#1a1b25;letter-spacing:-0.03em;margin:0;line-height:1.2;text-align:center;">
      ${heading}
    </h1>
  </td></tr>

  <!-- INTRO -->
  <tr><td class="pad" style="padding:0 8px 28px;">
    <div style="font-size:15px;color:#424751;line-height:1.75;text-align:center;">
      <p style="margin:0;">${intro}</p>
    </div>
  </td></tr>

  <!-- FEATURES -->
  <tr><td style="padding:0 0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${featuresHtml}
    </table>
  </td></tr>

  ${earlyAdopterHtml}

  <!-- CTA PRINCIPAL -->
  <tr><td align="center" style="padding-bottom:12px;">
    <a href="${BASE_URL}"
      style="display:inline-block;background:#2f6fb8;color:#ffffff;font-size:15px;
      font-weight:700;text-decoration:none;padding:16px 44px;border-radius:9999px;
      letter-spacing:0.01em;">
      Découvrir la plateforme →
    </a>
  </td></tr>

  <!-- CTA SECONDAIRE -->
  <tr><td align="center" style="padding-bottom:12px;">
    <a href="${BASE_URL}/register"
      style="display:inline-block;background:#ffffff;color:#2f6fb8;font-size:14px;
      font-weight:700;text-decoration:none;padding:14px 36px;border-radius:9999px;
      border:2px solid #2f6fb8;letter-spacing:0.01em;">
      Créer mon compte gratuitement
    </a>
  </td></tr>

  <!-- CTA TERTIAIRE — offre early adopter -->
  ${target === "pro" ? `
  <tr><td align="center" style="padding-bottom:44px;">
    <a href="${BASE_URL}/early-adopter"
      style="display:inline-block;background:#fbbf24;color:#1a1b25;font-size:14px;
      font-weight:800;text-decoration:none;padding:14px 36px;border-radius:9999px;
      letter-spacing:0.01em;">
      🎯 Rejoindre les 50 premiers — −50% pendant 3 ans
    </a>
  </td></tr>` : `
  <tr><td style="padding-bottom:44px;"></td></tr>`}

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
      Vous recevez cet email car notre équipe a pensé que la plateforme pourrait vous intéresser.<br/>
      Vous pouvez ignorer ce message si ce n'est pas le cas.<br/><br/>
      <a href="${BASE_URL}" style="color:#9ea4a9;text-decoration:underline;">dealandcompany.fr</a>
      &nbsp;·&nbsp; &copy; 2025 Deal &amp; Co — Tous droits réservés.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}

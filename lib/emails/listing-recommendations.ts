/**
 * Email « nouvelles annonces près de chez vous ».
 *
 * Un email par personne et par campagne, jamais un par annonce : quelqu'un
 * d'intéressé par six maisons autour de Boulogne recevrait sinon six emails en
 * dix minutes, ce qu'aucun filtre anti-spam ne pardonne et qu'aucun
 * destinataire ne pardonne non plus.
 *
 * Chaque carte porte ce qui permet de décider sans ouvrir la page : photo,
 * titre, prix, commune, deux lignes de description. Le bouton mène à l'URL
 * publique canonique de l'annonce — celle qui est indexée, avec ses données
 * structurées et son Open Graph. L'email est une source de trafic vers les
 * pages du site, pas un canal parallèle.
 *
 * La distance n'est affichée que lorsque la position de l'utilisateur est
 * *certaine*. Écrire « à 4,8 km de chez vous » à quelqu'un qu'on a localisé en
 * regardant ce qu'il consulte, c'est prétendre savoir où il habite.
 */

import { formatDistance } from "@/lib/geo/distance";

const BASE = "https://www.dealandcompany.fr";

export type RecommendedListing = {
  id: string;
  title: string;
  price: number;
  location: string;
  description: string;
  imageUrl: string | null;
  url: string;
  /** Affichée uniquement si `showDistance` est vrai. */
  distanceKm: number | null;
  showDistance: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Extrait lisible d'une description.
 *
 * Coupe au mot, jamais au caractère : « Maison familiale de 95 m² avec jar… »
 * donne l'impression d'un bug, « Maison familiale de 95 m² avec… » d'un choix.
 */
export function excerpt(raw: string, maxLength = 110): string {
  const text = (raw ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;

  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  const kept = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${kept.replace(/[,;:.\s]+$/, "")}…`;
}

/** Vignette, ou aplat neutre quand l'annonce n'a pas de photo. */
function thumbnail(listing: RecommendedListing): string {
  if (listing.imageUrl) {
    return `<img src="${escapeHtml(listing.imageUrl)}" alt="${escapeHtml(listing.title)}"
        width="120" height="120"
        style="display:block;width:120px;height:120px;object-fit:cover;border-radius:13px 0 0 13px;background:#f2f4f6;"/>`;
  }
  return `<div style="width:120px;height:120px;border-radius:13px 0 0 13px;background:#f2f4f6;
      text-align:center;line-height:120px;font-size:11px;color:#9ea4a9;">Pas de photo</div>`;
}

function card(listing: RecommendedListing): string {
  const place = escapeHtml(listing.location);
  const distance =
    listing.showDistance && listing.distanceKm !== null
      ? ` &middot; à ${formatDistance(listing.distanceKm)}`
      : "";
  const summary = excerpt(listing.description);

  return `
    <tr>
      <td style="padding:0 0 14px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="border:1px solid #eceef0;border-radius:14px;background:#ffffff;">
          <tr>
            <td width="120" style="padding:0;vertical-align:top;">
              <a href="${listing.url}" style="text-decoration:none;">${thumbnail(listing)}</a>
            </td>
            <td style="padding:14px 16px;vertical-align:top;">
              <a href="${listing.url}" style="text-decoration:none;color:#1a1b25;">
                <span style="display:block;font-size:15px;font-weight:600;line-height:1.3;margin:0 0 4px;">
                  ${escapeHtml(listing.title)}
                </span>
              </a>
              <div style="font-size:12px;color:#727782;margin:0 0 6px;">📍 ${place}${distance}</div>
              <div style="font-size:16px;font-weight:700;color:#2f6fb8;margin:0 0 6px;">
                ${listing.price.toLocaleString("fr-FR")} €
              </div>
              ${summary ? `<div style="font-size:13px;color:#727782;line-height:1.5;margin:0 0 10px;">${escapeHtml(summary)}</div>` : ""}
              <a href="${listing.url}"
                style="display:inline-block;background:#2f6fb8;color:#ffffff;font-size:13px;font-weight:600;
                text-decoration:none;padding:9px 18px;border-radius:9999px;">Voir l'annonce</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/**
 * Regroupe les communes présentes dans l'email : « autour de Paris,
 * Neuilly-sur-Seine et 2 autres communes ». Sert de sous-titre honnête — il
 * décrit les annonces, il ne prétend rien sur l'adresse du destinataire.
 */
export function summarizePlaces(places: string[]): string {
  const unique = [...new Set(places.filter(Boolean))];
  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} et ${unique[1]}`;
  const rest = unique.length - 2;
  return `${unique[0]}, ${unique[1]} et ${rest} autre${rest > 1 ? "s" : ""} commune${rest > 1 ? "s" : ""}`;
}

export function listingRecommendationsEmail({
  firstName,
  categoryLabel,
  listings,
  categoryUrl,
  manageUrl,
  placesSummary,
}: {
  /** Prénom si connu ; l'email reste correct sans lui. */
  firstName: string | null;
  categoryLabel: string;
  listings: RecommendedListing[];
  categoryUrl: string;
  manageUrl: string;
  placesSummary: string;
}): string {
  const count = listings.length;
  const plural = count > 1;
  const greeting = firstName ? `Bonjour ${escapeHtml(firstName)},` : "Bonjour,";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${count} nouvelle${plural ? "s" : ""} annonce${plural ? "s" : ""} ${escapeHtml(categoryLabel)} — Deal &amp; Co</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@700;800&display=swap" rel="stylesheet"/>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
    body{margin:0;padding:0;background:#ffffff;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;}
    img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;}
    @media(max-width:620px){.wrap{width:100%!important;}.pad{padding:0 16px 24px!important;}.h1{font-size:26px!important;}}
  </style>
</head>
<body bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff">
<tr><td align="center" style="padding:44px 16px;">
<table class="wrap" role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- LOGO -->
  <tr><td align="center" style="padding-bottom:30px;">
    <img src="${BASE}/logo.png" alt="Deal &amp; Co" width="140" style="display:block;height:auto;"/>
  </td></tr>

  <!-- TITRE -->
  <tr><td align="center" style="padding-bottom:8px;">
    <h1 class="h1" style="font-family:Manrope,sans-serif;font-size:29px;font-weight:800;
      color:#1a1b25;letter-spacing:-0.03em;margin:0;line-height:1.2;text-align:center;">
      ${count} nouvelle${plural ? "s" : ""} annonce${plural ? "s" : ""} ${escapeHtml(categoryLabel)}
    </h1>
  </td></tr>

  <!-- SOUS-TITRE -->
  <tr><td align="center" style="padding-bottom:26px;">
    <p style="font-size:15px;color:#727782;margin:0;text-align:center;line-height:1.5;">
      ${escapeHtml(greeting)}<br/>
      ${placesSummary ? `Publiées à ${escapeHtml(placesSummary)}.` : "Publiées près de votre zone."}
    </p>
  </td></tr>

  <!-- ANNONCES -->
  <tr><td class="pad" style="padding:0 8px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${listings.map(card).join("")}
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td align="center" style="padding:14px 0 36px;">
    <a href="${categoryUrl}"
      style="display:inline-block;background:#1a1b25;color:#ffffff;font-size:15px;
      font-weight:700;text-decoration:none;padding:15px 36px;border-radius:9999px;">
      Voir toutes les annonces ${escapeHtml(categoryLabel)}
    </a>
  </td></tr>

  <!-- SÉPARATEUR -->
  <tr><td style="padding-bottom:28px;">
    <div style="height:1px;background:#eceef0;"></div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td align="center" style="padding-bottom:44px;">
    <p style="font-size:12px;color:#9ea4a9;line-height:1.7;margin:0;text-align:center;">
      Vous recevez cet email parce que vos annonces et vos consultations sur
      <a href="${BASE}" style="color:#9ea4a9;text-decoration:underline;">dealandcompany.fr</a>
      concernent cette catégorie et cette zone.<br/>
      <a href="${manageUrl}" style="color:#9ea4a9;text-decoration:underline;">Gérer mes préférences ou me désabonner</a>
      &nbsp;·&nbsp; &copy; ${new Date().getFullYear()} Deal &amp; Co
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Sujet dynamique — le nombre est celui des annonces réellement retenues. */
export function recommendationSubject(count: number, categoryLabel: string): string {
  return count > 1
    ? `${count} nouvelles annonces ${categoryLabel} près de chez vous`
    : `Une nouvelle annonce ${categoryLabel} près de chez vous`;
}

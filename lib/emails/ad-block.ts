import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";
import { selectAd } from "@/lib/ads/engine";

const BASE = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";

type AdRow = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  destinationUrl: string;
};

/**
 * Pick one active ad to render in an email. Picks the most recently created
 * still-active ad whose schedule has started (or is unscheduled) and which
 * has not expired. Returns null when no ad is eligible.
 */
async function pickEmailAd(): Promise<AdRow | null> {
  const now = new Date();
  try {
    const rows = await prisma.$queryRaw<AdRow[]>`
      SELECT id, title, description, "imageUrl", "destinationUrl"
      FROM "Advertisement"
      WHERE "isActive" = true
        AND ("scheduledAt" IS NULL OR "scheduledAt" <= ${now})
        AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
      ORDER BY random()
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function trackedUrl(ad: AdRow, source: string): string {
  const sep = ad.destinationUrl.includes("?") ? "&" : "?";
  return `${ad.destinationUrl}${sep}utm_source=email&utm_medium=${encodeURIComponent(source)}&utm_campaign=ad_${ad.id}`;
}

/**
 * Gabarit commun aux deux origines — régie et bannières maison.
 *
 * Le cadre est identique pour que le passage de l'une à l'autre ne se voie
 * pas : même hauteur, même mention « Publicité », même place dans le message.
 */
function block(input: {
  href: string;
  img: string;
  title: string;
  description: string;
  pixel?: string;
}): string {
  return `
  <!-- AD BLOCK -->
  <tr><td style="padding:4px 8px 20px;">
    <p style="font-size:9px;color:#b5b9bd;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 4px;text-align:left;font-weight:500;">
      Publicité
    </p>
    <a href="${esc(input.href)}" style="display:block;text-decoration:none;border-top:1px solid #f0f1f3;border-bottom:1px solid #f0f1f3;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 8px 8px 0;width:48px;vertical-align:middle;">
            <img src="${esc(input.img)}" alt="${esc(input.title)}" width="48" height="48"
              style="display:block;width:48px;height:48px;object-fit:cover;border-radius:6px;"/>
          </td>
          <td style="padding:8px 0;vertical-align:middle;">
            <div style="font-family:Manrope,sans-serif;font-size:12px;font-weight:600;color:#4a4f57;line-height:1.3;">
              ${esc(input.title)}
            </div>
            <div style="font-size:11px;color:#9ea4a9;line-height:1.4;margin-top:2px;">
              ${esc(input.description)}
            </div>
          </td>
        </tr>
      </table>
    </a>${input.pixel ? `
    <img src="${esc(input.pixel)}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;"/>` : ""}
  </td></tr>`;
}

/**
 * Encart publicitaire d'un e-mail.
 *
 * L'e-mail est une surface de régie à part entière, avec ses propres
 * contraintes : pas de JavaScript, donc pas d'observateur de visibilité —
 * l'impression se compte au pixel d'ouverture, comme le fait tout le métier ;
 * et un message peut être ouvert trois semaines après son envoi, d'où un jeton
 * de longue durée signé à l'envoi.
 *
 * L'identifiant de session est tiré ici, une fois par message : c'est lui qui
 * fait qu'un destinataire qui rouvre le même e-mail dix fois ne coûte pas dix
 * impressions à l'annonceur.
 *
 * Sans campagne éligible, on retombe sur les bannières maison — l'e-mail ne
 * doit pas partir avec un trou à la place de l'encart.
 */
export async function renderEmailAd(source: string): Promise<string> {
  const served = await selectAd({ placement: "EMAIL_BANNER", platform: "EMAIL" }).catch(() => null);

  if (served) {
    const session = randomBytes(9).toString("base64url");
    const query = `t=${encodeURIComponent(served.token)}&s=${encodeURIComponent(session)}`;
    return block({
      href: `${BASE}/api/ads/go?${query}&src=${encodeURIComponent(source)}`,
      pixel: `${BASE}/api/ads/pixel?${query}`,
      img: served.imageUrl.startsWith("http") ? served.imageUrl : `${BASE}${served.imageUrl}`,
      title: served.title,
      description: served.description,
    });
  }

  const ad = await pickEmailAd();
  if (!ad) return "";

  return block({
    href: trackedUrl(ad, source),
    img: ad.imageUrl.startsWith("http") ? ad.imageUrl : `${BASE}${ad.imageUrl}`,
    title: ad.title,
    description: ad.description,
  });
}

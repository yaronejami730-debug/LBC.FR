import { prisma } from "@/lib/prisma";

const BASE = "https://www.dealandcompany.fr";

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
 * Renders an HTML ad block (table-based, email-client safe) to embed in
 * transactional emails. Returns an empty string when no ad is eligible —
 * callers can blindly concatenate this into their template.
 */
export async function renderEmailAd(source: string): Promise<string> {
  const ad = await pickEmailAd();
  if (!ad) return "";

  const target = trackedUrl(ad, source);
  const img = ad.imageUrl.startsWith("http") ? ad.imageUrl : `${BASE}${ad.imageUrl}`;

  return `
  <!-- AD BLOCK -->
  <tr><td style="padding:8px 8px 32px;">
    <p style="font-size:10px;color:#9ea4a9;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 8px;text-align:center;font-weight:600;">
      Publicité
    </p>
    <a href="${esc(target)}" style="display:block;text-decoration:none;border:1px solid #eceef0;border-radius:14px;overflow:hidden;background:#fafbfc;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:14px;width:96px;vertical-align:middle;">
            <img src="${esc(img)}" alt="${esc(ad.title)}" width="96" height="96"
              style="display:block;width:96px;height:96px;object-fit:cover;border-radius:10px;"/>
          </td>
          <td style="padding:14px 16px 14px 0;vertical-align:middle;">
            <div style="font-family:Manrope,sans-serif;font-size:15px;font-weight:700;color:#1a1b25;line-height:1.3;margin-bottom:4px;">
              ${esc(ad.title)}
            </div>
            <div style="font-size:13px;color:#727782;line-height:1.5;">
              ${esc(ad.description)}
            </div>
            <div style="margin-top:8px;font-size:12px;color:#2f6fb8;font-weight:600;">
              En savoir plus →
            </div>
          </td>
        </tr>
      </table>
    </a>
  </td></tr>`;
}

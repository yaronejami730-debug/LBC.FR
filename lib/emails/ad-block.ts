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
  <tr><td style="padding:4px 8px 20px;">
    <p style="font-size:9px;color:#b5b9bd;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 4px;text-align:left;font-weight:500;">
      Publicité
    </p>
    <a href="${esc(target)}" style="display:block;text-decoration:none;border-top:1px solid #f0f1f3;border-bottom:1px solid #f0f1f3;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 8px 8px 0;width:48px;vertical-align:middle;">
            <img src="${esc(img)}" alt="${esc(ad.title)}" width="48" height="48"
              style="display:block;width:48px;height:48px;object-fit:cover;border-radius:6px;"/>
          </td>
          <td style="padding:8px 0;vertical-align:middle;">
            <div style="font-family:Manrope,sans-serif;font-size:12px;font-weight:600;color:#4a4f57;line-height:1.3;">
              ${esc(ad.title)}
            </div>
            <div style="font-size:11px;color:#9ea4a9;line-height:1.4;margin-top:2px;">
              ${esc(ad.description)}
            </div>
          </td>
        </tr>
      </table>
    </a>
  </td></tr>`;
}

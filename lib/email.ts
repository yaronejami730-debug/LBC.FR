import { renderEmailAd } from "@/lib/emails/ad-block";
import { emailPrefUrl, createEmailTrackToken } from "@/lib/email-token";
import { injectEmailTracking, recordEmailEvent } from "@/lib/email-tracking";

const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const FROM_EMAIL = "notif@dealandcompany.fr";
const FROM_NAME = "Deal & Co";
const TRACK_BASE = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";

/**
 * Inject an active ad block into rendered email HTML right before the footer
 * separator. Works on any template that goes through baseEmail() — the
 * separator comment is the splice marker. Skips when no ad available, when
 * adSource starts with "admin", or when marker absent.
 */
async function withAd(html: string, source: string): Promise<string> {
  if (source.startsWith("admin")) return html;
  const adHtml = await renderEmailAd(source);
  if (!adHtml) return html;
  const marker = "<!-- SÉPARATEUR -->";
  if (!html.includes(marker)) return html;
  return html.replace(marker, `${adHtml}\n  ${marker}`);
}

export async function sendEmail({
  to,
  toName,
  subject,
  html,
  adSource,
  userId,
}: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  /** Identifies the email type for ad UTM tracking. Pass "admin*" to skip ads. */
  adSource?: string;
  /** When provided, attaches a personal List-Unsubscribe link for one-click unsub. */
  userId?: string;
}) {
  const emailType = adSource ?? "transactional";
  const adultHtml = await withAd(html, emailType);

  // Tracking : pixel d'ouverture + redirecteur de clic. Désactivé pour les
  // emails admin (mêmes critères que pour le bloc pub).
  const finalHtml = emailType.startsWith("admin")
    ? adultHtml
    : (() => {
        const token = createEmailTrackToken({ userId, email: to, emailType });
        recordEmailEvent({ userId, email: to, emailType, kind: "sent" });
        return injectEmailTracking(adultHtml, token, TRACK_BASE);
      })();

  const headers: Record<string, string> = {};
  if (userId) {
    const unsubUrl = emailPrefUrl(userId);
    headers["List-Unsubscribe"] = `<${unsubUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to, name: toName ?? to }],
      subject,
      htmlContent: finalHtml,
      ...(Object.keys(headers).length ? { headers } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error: ${err}`);
  }

  return res.json();
}

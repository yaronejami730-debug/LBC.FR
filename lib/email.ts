import { renderEmailAd } from "@/lib/emails/ad-block";

const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const FROM_EMAIL = "notif@dealandcompany.fr";
const FROM_NAME = "Deal & Co";

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
}: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  /** Identifies the email type for ad UTM tracking. Pass "admin*" to skip ads. */
  adSource?: string;
}) {
  const finalHtml = await withAd(html, adSource ?? "transactional");

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
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error: ${err}`);
  }

  return res.json();
}

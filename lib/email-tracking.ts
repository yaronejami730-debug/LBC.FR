/**
 * Tracking d'email — pixel d'ouverture + redirecteur de clic + journal d'événements.
 *
 * Le moteur comportemental a besoin de savoir :
 *  - qui ouvre quel type d'email et à quelle heure → choix du canal/timing
 *  - sur quel lien le destinataire clique → niveau d'intérêt
 *
 * Limitation connue : les pixels d'ouverture sont fréquemment bloqués
 * (Apple Mail Privacy Protection, clients mail entreprise). Les opens sont
 * donc sous-estimés ; les clics restent fiables.
 */

import { prisma } from "@/lib/prisma";
import { signRedirectUrl } from "@/lib/email-token";

/** Enregistre un événement d'email. Fire-and-forget — ne bloque jamais l'envoi. */
export function recordEmailEvent(e: {
  userId?: string | null;
  email: string;
  emailType: string;
  kind: "sent" | "open" | "click";
  url?: string | null;
}): void {
  prisma.emailEvent
    .create({
      data: {
        userId: e.userId ?? null,
        email: e.email,
        emailType: e.emailType,
        kind: e.kind,
        url: e.url ?? null,
      },
    })
    .catch((err) => console.error("[EmailEvent] insert échec:", err));
}

/**
 * Injecte le tracking dans le HTML d'un email :
 *   - pixel d'ouverture invisible avant `</body>` (ou en fin de document)
 *   - réécriture des liens http(s) du corps vers `/api/email/click`
 *     (avec URL signée pour empêcher tout abus d'open-redirect)
 *
 * Liens préservés tels quels : ceux pointant déjà vers `/api/email/` (auto),
 * la page de préférences email (gérée par son propre token), et `mailto:`.
 */
export function injectEmailTracking(html: string, token: string, baseUrl: string): string {
  const openPixel =
    `<img src="${baseUrl}/api/email/open?t=${token}" width="1" height="1" ` +
    `style="display:none;max-height:0;overflow:hidden" alt="" />`;

  let out = html.replace(/href="(https?:\/\/[^"]+)"/gi, (match, url: string) => {
    if (url.includes("/api/email/") || url.includes("/preferences/email")) return match;
    const sig = signRedirectUrl(url);
    const wrapped =
      `${baseUrl}/api/email/click?t=${token}` +
      `&u=${encodeURIComponent(url)}&s=${encodeURIComponent(sig)}`;
    return `href="${wrapped}"`;
  });

  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${openPixel}</body>`);
  } else {
    out += openPixel;
  }
  return out;
}

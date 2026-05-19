/**
 * Redirecteur de clic d'email. Vérifie la signature de l'URL pour qu'aucune
 * URL non émise par notre injecteur ne puisse être atteinte (anti
 * open-redirect). Enregistre l'événement `click` si le token est valide.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyEmailTrackToken, verifyRedirectUrl } from "@/lib/email-token";
import { recordEmailEvent } from "@/lib/email-tracking";

const FALLBACK_URL = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("t");
  const dest = searchParams.get("u");
  const sig = searchParams.get("s");

  let target = FALLBACK_URL;
  if (dest && sig && verifyRedirectUrl(dest, sig)) {
    try {
      const u = new URL(dest);
      if (u.protocol === "http:" || u.protocol === "https:") target = u.toString();
    } catch {
      /* URL invalide malgré la signature — repli accueil */
    }
  }

  if (token) {
    const data = verifyEmailTrackToken(token);
    if (data) {
      recordEmailEvent({
        userId: data.userId,
        email: data.email,
        emailType: data.emailType,
        kind: "click",
        url: target,
      });
    }
  }

  return NextResponse.redirect(target, 302);
}

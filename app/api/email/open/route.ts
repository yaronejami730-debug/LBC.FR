/**
 * Pixel d'ouverture d'email. Renvoie un GIF transparent 1×1, enregistre
 * l'événement `open` si le token est valide. Toujours 200 + jamais en cache.
 */

import { NextRequest } from "next/server";
import { verifyEmailTrackToken } from "@/lib/email-token";
import { recordEmailEvent } from "@/lib/email-tracking";

// GIF transparent 1×1.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("t");
  if (token) {
    const data = verifyEmailTrackToken(token);
    if (data) {
      recordEmailEvent({
        userId: data.userId,
        email: data.email,
        emailType: data.emailType,
        kind: "open",
      });
    }
  }
  return new Response(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
    },
  });
}

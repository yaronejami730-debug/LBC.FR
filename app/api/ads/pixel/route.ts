import { NextResponse, type NextRequest } from "next/server";
import { recordAdEvent } from "@/lib/ads/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GIF transparent d'un pixel — la charge utile minimale d'un compteur. */
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

/**
 * Impression d'une publicité insérée dans un e-mail.
 *
 * Un client de messagerie n'exécute pas de JavaScript : il n'y a pas
 * d'observateur de visibilité, seulement le chargement des images. L'ouverture
 * est donc mesurée comme partout ailleurs dans le métier, par une image d'un
 * pixel — avec les mêmes limites, qu'il faut connaître : une boîte qui bloque
 * les images ne compte rien, un cache qui les préfetche compte une ouverture
 * jamais lue. La déduplication par jeton et par destinataire évite au moins
 * qu'un même message facture dix fois.
 *
 * La réponse est toujours une image, même quand rien n'est enregistré : un
 * carré cassé dans un e-mail légitime pour une histoire de jeton expiré serait
 * un mauvais échange.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const sessionId = (req.nextUrl.searchParams.get("s") ?? "").slice(0, 64);

  if (token && sessionId) {
    await recordAdEvent({ type: "IMPRESSION", token, sessionId }).catch(() => null);
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.byteLength),
      // Sans cela, un proxy d'images renverrait le pixel depuis son cache et
      // l'ouverture suivante ne serait jamais vue.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Pragma": "no-cache",
    },
  });
}

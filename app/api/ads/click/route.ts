import { NextResponse, type NextRequest } from "next/server";
import { clickDestination, recordAdEvent } from "@/lib/ads/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clic publicitaire.
 *
 * La destination est relue en base à partir du jeton : le client ne dit jamais
 * où il va, sinon un lien fabriqué enverrait les visiteurs de Deal&Co
 * n'importe où sous couvert de publicité.
 *
 * Le clic part toujours vers sa destination, même écarté par l'anti-fraude :
 * si la personne est réelle, elle a le droit d'arriver chez l'annonceur. Ce
 * qui change, c'est la facture — un clic douteux n'est pas débité.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = String(body.token ?? "");
  const sessionId = String(body.sessionId ?? "").slice(0, 64);
  if (!token || !sessionId) {
    return NextResponse.json({ error: "Requête incomplète." }, { status: 400 });
  }

  const [result, destination] = await Promise.all([
    recordAdEvent({
      type: "CLICK",
      token,
      sessionId,
      pageViewId: body.pageViewId ? String(body.pageViewId) : null,
      userAgent: req.headers.get("user-agent"),
    }),
    clickDestination(token),
  ]);

  if (!destination) {
    return NextResponse.json({ ...result, destination: null }, { status: 404 });
  }
  return NextResponse.json({ ...result, destination });
}

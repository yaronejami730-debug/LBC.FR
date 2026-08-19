import { NextResponse, type NextRequest } from "next/server";
import { recordAdEvent } from "@/lib/ads/tracking";
import { MIN_VIEWPORT_RATIO, MIN_VISIBLE_MS } from "@/lib/ads/viewability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Impression visible — conservée pour les clients déjà déployés.
 *
 * La route de référence est désormais `/api/ads/event`, qui porte les quatre
 * états d'une publicité. Celle-ci reste parce que l'application mobile publiée
 * l'appelle encore : la retirer couperait la mesure sur les appareils qui ne
 * se mettent pas à jour.
 *
 * Sans mesure fournie, on retombe sur le seuil minimal plutôt que sur une
 * visibilité parfaite : un ancien client ne doit pas obtenir un meilleur
 * traitement qu'un client à jour qui mesure vraiment.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = String(body.token ?? "");
  const sessionId = String(body.sessionId ?? "").slice(0, 64);
  if (!token || !sessionId) {
    return NextResponse.json({ error: "Requête incomplète." }, { status: 400 });
  }

  const result = await recordAdEvent({
    type: "VIEWABLE_IMPRESSION",
    token,
    sessionId,
    pageViewId: body.pageViewId ? String(body.pageViewId) : null,
    viewportPct: typeof body.viewportPct === "number" ? body.viewportPct : MIN_VIEWPORT_RATIO,
    visibleMs: typeof body.visibleMs === "number" ? body.visibleMs : MIN_VISIBLE_MS,
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json(result);
}

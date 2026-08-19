import { NextResponse, type NextRequest } from "next/server";
import { clickDestination, isEventType, recordAdEvent } from "@/lib/ads/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Route unique des événements publicitaires.
 *
 * Un seul chemin pour les quatre états d'une publicité — chargée, rendue,
 * réellement visible, cliquée. Les séparer en quatre routes multipliait les
 * endroits où l'on peut oublier un contrôle ; ici, tout événement passe par la
 * même validation, la même déduplication et la même facturation.
 *
 * Le client fournit une mesure, jamais un verdict : il dit « 62 % du bloc
 * pendant 1 400 ms », le serveur décide si cela vaut une impression visible.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const type = String(body.type ?? "");
  if (!isEventType(type)) {
    return NextResponse.json({ error: "Type d'événement inconnu." }, { status: 400 });
  }

  const token = String(body.token ?? "");
  const sessionId = String(body.sessionId ?? "").slice(0, 64);
  if (!token || !sessionId) {
    return NextResponse.json({ error: "Requête incomplète." }, { status: 400 });
  }

  const result = await recordAdEvent({
    type,
    token,
    sessionId,
    pageViewId: body.pageViewId ? String(body.pageViewId) : null,
    viewportPct: typeof body.viewportPct === "number" ? body.viewportPct : null,
    visibleMs: typeof body.visibleMs === "number" ? body.visibleMs : null,
    conversionType: body.conversionType ? String(body.conversionType) : null,
    userAgent: req.headers.get("user-agent"),
  });

  // Le clic est le seul type qui a besoin d'une réponse : le visiteur attend
  // d'être emmené quelque part. La destination est relue en base, jamais
  // envoyée par le client.
  if (type === "CLICK") {
    const destination = await clickDestination(token);
    return NextResponse.json({ ...result, destination: destination ?? null });
  }

  return NextResponse.json(result);
}

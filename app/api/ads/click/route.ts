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
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; sessionId?: unknown };
  const token = String(body.token ?? "");
  const sessionId = String(body.sessionId ?? "").slice(0, 64);
  if (!token || !sessionId) {
    return NextResponse.json({ error: "Requête incomplète." }, { status: 400 });
  }

  const [result, destination] = await Promise.all([
    recordAdEvent({ type: "CLICK", token, sessionId }),
    clickDestination(token),
  ]);

  if (!destination) {
    return NextResponse.json({ ...result, destination: null }, { status: 404 });
  }
  return NextResponse.json({ ...result, destination });
}

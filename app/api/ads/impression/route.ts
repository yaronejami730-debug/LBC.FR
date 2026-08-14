import { NextResponse, type NextRequest } from "next/server";
import { recordAdEvent } from "@/lib/ads/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Impression réellement affichée, remontée par le client avec son jeton. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; sessionId?: unknown };
  const token = String(body.token ?? "");
  const sessionId = String(body.sessionId ?? "").slice(0, 64);
  if (!token || !sessionId) {
    return NextResponse.json({ error: "Requête incomplète." }, { status: 400 });
  }

  const result = await recordAdEvent({ type: "IMPRESSION", token, sessionId });
  return NextResponse.json(result);
}

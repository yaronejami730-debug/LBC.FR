import { NextResponse, type NextRequest } from "next/server";
import { classifyTitle } from "@/lib/category/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Classification d'un titre — conservée pour les appelants existants.
 *
 * Servait auparavant `lib/listing-engine/`, qui ne classait rien : mesuré à
 * l'audit, il renvoyait « question » sur les trente titres testés. Elle sert
 * maintenant le moteur unique, comme `/api/category/suggest`.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { title?: unknown; text?: unknown };
  const title = String(body.title ?? body.text ?? "").slice(0, 200);
  if (title.trim().length < 3) return NextResponse.json({ result: null });

  return NextResponse.json({ result: classifyTitle(title) }, { headers: { "Cache-Control": "no-store" } });
}

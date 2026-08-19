import { NextResponse, type NextRequest } from "next/server";
import { recordAdEvent } from "@/lib/ads/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Natures de contact reconnues. Une liste fermée : « contact » ne veut rien
 *  dire tant qu'on n'a pas dit lequel. */
const CONVERSION_TYPES = ["PHONE", "EMAIL", "MESSAGE", "FORM", "BOOKING"];

/**
 * Conversion attribuée à une publicité.
 *
 * C'est ce qui donne un sens à l'objectif « recevoir plus de contacts » : sans
 * événement de conversion, le coût par contact serait un coût par clic
 * renommé. Une conversion n'est jamais facturée en soi — la campagne paie ses
 * clics ou ses impressions visibles — elle mesure ce que ces clics ont produit.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const token = String(body.token ?? "");
  const sessionId = String(body.sessionId ?? "").slice(0, 64);
  const conversionType = String(body.conversionType ?? "").toUpperCase();

  if (!token || !sessionId) {
    return NextResponse.json({ error: "Requête incomplète." }, { status: 400 });
  }
  if (!CONVERSION_TYPES.includes(conversionType)) {
    return NextResponse.json({ error: "Nature de contact inconnue." }, { status: 400 });
  }

  const result = await recordAdEvent({
    type: "CONVERSION",
    token,
    sessionId,
    pageViewId: body.pageViewId ? String(body.pageViewId) : null,
    conversionType,
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json(result);
}

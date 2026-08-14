import { NextResponse, type NextRequest } from "next/server";
import { selectAd } from "@/lib/ads/engine";
import { isPlacement } from "@/lib/ads/placements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demande de publicité — même route pour le site et pour l'application.
 *
 * Le client décrit son contexte, il ne choisit rien : ni la campagne, ni le
 * prix, ni la publicité. C'est ce qui garantit que le web et le mobile
 * facturent la même chose.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const placement = String(body.placement ?? "");
  if (!isPlacement(placement)) {
    return NextResponse.json({ error: "Emplacement inconnu." }, { status: 400 });
  }

  const ad = await selectAd({
    placement,
    city: body.city ? String(body.city) : null,
    category: body.category ? String(body.category) : null,
    platform: body.platform === "MOBILE" ? "MOBILE" : "WEB",
  });

  // Pas de publicité éligible : ce n'est pas une erreur, c'est l'inventaire.
  // Le client affiche sa mise en page sans encart.
  return NextResponse.json({ ad }, { headers: { "Cache-Control": "no-store" } });
}

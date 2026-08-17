import { NextResponse, type NextRequest } from "next/server";
import { selectAd } from "@/lib/ads/engine";
import { isPlacement } from "@/lib/ads/placements";
import { getAuthUserId } from "@/lib/auth-unified";
import { INTENT_COOKIE } from "@/lib/ads/intent-cookie";
import { pickHouseAd } from "@/lib/ads/house";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demande de publicité — même route pour le site et pour l'application.
 *
 * Le client décrit son contexte, il ne choisit rien : ni la campagne, ni le
 * prix, ni la publicité. C'est ce qui garantit que le web et le mobile
 * facturent la même chose.
 *
 * Le contexte s'est enrichi pour le ciblage : les catégories récemment
 * parcourues viennent du navigateur, l'intention d'arrivée d'un cookie posé au
 * premier chargement, les intérêts durables de la base — et ces derniers ne
 * sont lus que pour un compte identifié ici, côté serveur, jamais annoncés par
 * le client. Un navigateur qui prétendrait « je suis untel » ne changerait
 * rien.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const placement = String(body.placement ?? "");
  if (!isPlacement(placement)) {
    return NextResponse.json({ error: "Emplacement inconnu." }, { status: 400 });
  }

  const userId = await getAuthUserId(req).catch(() => null);

  const recentCategories = Array.isArray(body.recentCategories)
    ? body.recentCategories.slice(0, 3).map((v) => String(v).slice(0, 60))
    : [];

  const landingKeywords = (req.cookies.get(INTENT_COOKIE)?.value ?? "")
    .split("|")
    .map((v) => decodeURIComponent(v).trim())
    .filter((v) => v.length >= 3)
    .slice(0, 3);

  const excludeAdIds = Array.isArray(body.excludeAdIds)
    ? body.excludeAdIds.slice(0, 12).map((v) => String(v).slice(0, 40))
    : [];

  const ad = await selectAd({
    placement,
    city: body.city ? String(body.city) : null,
    category: body.category ? String(body.category) : null,
    platform: body.platform === "MOBILE" ? "MOBILE" : "WEB",
    userId,
    recentCategories,
    landingKeywords,
    excludeAdIds,
  });

  // Pas de campagne éligible : ce n'est pas une erreur, c'est l'inventaire. On
  // propose alors une bannière maison — non facturée, sans jeton — pour que
  // l'emplacement existe visiblement au lieu de disparaître. Le client peut
  // toujours préférer son propre repli.
  const house = ad ? null : await pickHouseAd();

  return NextResponse.json({ ad, house }, { headers: { "Cache-Control": "no-store" } });
}

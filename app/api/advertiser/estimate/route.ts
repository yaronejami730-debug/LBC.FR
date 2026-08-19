import { NextResponse, type NextRequest } from "next/server";
import { requireActiveAdvertiser } from "@/lib/ads/advertiser-auth";
import { auctionContext, estimateCampaign } from "@/lib/ads/estimate";
import { resolveLocation } from "@/lib/geo/communes";
import { normalizeToken } from "@/lib/seo/city";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Estimation affichée pendant la création de campagne.
 *
 * Réservée aux annonceurs connectés : ces chiffres décrivent l'inventaire réel
 * de Deal&Co, ils n'ont pas à circuler librement.
 */
export async function POST(req: NextRequest) {
  const advertiser = await requireActiveAdvertiser();
  if (!advertiser) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    placements?: unknown;
    zones?: unknown;
    dailyBudgetCents?: unknown;
    objective?: unknown;
  };

  const placements = Array.isArray(body.placements) ? body.placements.map(String) : [];
  // Les zones arrivent en libellés saisis par l'annonceur ; on les résout ici,
  // comme à l'enregistrement, pour comparer des communes et non des chaînes.
  const citySlugs = (Array.isArray(body.zones) ? body.zones : [])
    .map((z) => resolveLocation(String((z as { label?: unknown })?.label ?? z)))
    .filter(Boolean)
    .map((r) => normalizeToken(r!.city));

  const [estimate, auction] = await Promise.all([
    estimateCampaign({
      placements,
      citySlugs,
      dailyBudgetCents: Math.max(0, Math.round(Number(body.dailyBudgetCents) || 0)),
    }),
    // Contexte d'enchère : le plancher et le prix médian constaté. Ils
    // accompagnent le champ « enchère maximale », qui sans repère ne veut rien
    // dire pour quelqu'un dont ce n'est pas le métier.
    auctionContext({ placements, objective: String(body.objective ?? "VISITES") }),
  ]);

  return NextResponse.json({ estimate, auction }, { headers: { "Cache-Control": "no-store" } });
}

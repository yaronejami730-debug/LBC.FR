import { NextResponse, type NextRequest } from "next/server";
import { requireActiveAdvertiser } from "@/lib/ads/advertiser-auth";
import {
  archiveCampaign,
  CampaignError,
  pauseCampaign,
  resumeCampaign,
} from "@/lib/ads/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Arrêt, reprise, archivage — les trois gestes que l'annonceur maîtrise.
 *
 * Tout le reste (fin de budget, portefeuille vide, refus) est décidé par le
 * serveur : ce sont des constats, pas des choix, et les mélanger ferait croire
 * à l'annonceur qu'il peut relancer une campagne dont le budget est consommé.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const advertiser = await requireActiveAdvertiser();
  if (!advertiser) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: unknown };
  const action = String(body.action ?? "");

  try {
    if (action === "pause") {
      return NextResponse.json({ campaign: await pauseCampaign(advertiser.id, id) });
    }
    if (action === "resume") {
      return NextResponse.json({ campaign: await resumeCampaign(advertiser.id, id) });
    }
    if (action === "archive") {
      return NextResponse.json({ campaign: await archiveCampaign(advertiser.id, id) });
    }
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (e) {
    if (e instanceof CampaignError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[advertiser/campaigns] changement d'état impossible", e);
    return NextResponse.json({ error: "Action impossible pour le moment." }, { status: 500 });
  }
}

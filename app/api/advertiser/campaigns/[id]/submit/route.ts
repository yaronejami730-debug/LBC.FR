import { NextResponse, type NextRequest } from "next/server";
import { requireActiveAdvertiser } from "@/lib/ads/advertiser-auth";
import { CampaignError, submitCampaign } from "@/lib/ads/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Soumission à la modération. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const advertiser = await requireActiveAdvertiser();
  if (!advertiser) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const campaign = await submitCampaign(advertiser.id, id);
    return NextResponse.json({ campaign });
  } catch (e) {
    if (e instanceof CampaignError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[advertiser/campaigns] soumission impossible", e);
    return NextResponse.json({ error: "Soumission impossible." }, { status: 500 });
  }
}

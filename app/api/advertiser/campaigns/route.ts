import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveAdvertiser } from "@/lib/ads/advertiser-auth";
import { CampaignError, createCampaign } from "@/lib/ads/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Campagnes de l'annonceur connecté.
 *
 * L'identité vient de la session, jamais de la requête : un `advertiserId`
 * envoyé par le navigateur est ignoré, il n'existe pas comme paramètre.
 */
export async function GET() {
  const advertiser = await requireActiveAdvertiser();
  if (!advertiser) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  const campaigns = await prisma.adCampaign.findMany({
    where: { advertiserId: advertiser.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      zones: { select: { label: true, radiusKm: true } },
      placements: { select: { placement: true } },
      ads: { select: { id: true, title: true, imageUrl: true, ctaLabel: true } },
    },
  });

  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const advertiser = await requireActiveAdvertiser();
  if (!advertiser) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  if (advertiser.mustChangePassword) {
    return NextResponse.json({ error: "Changez d'abord votre mot de passe." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const campaign = await createCampaign(advertiser.id, body);
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (e) {
    if (e instanceof CampaignError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[advertiser/campaigns] création impossible", e);
    return NextResponse.json({ error: "Création impossible pour le moment." }, { status: 500 });
  }
}

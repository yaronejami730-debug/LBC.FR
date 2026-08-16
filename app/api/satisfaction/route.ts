/**
 * Réception d'une réponse au questionnaire.
 *
 * L'authentification se fait par le jeton du lien, pas par la session : on
 * répond depuis sa boîte mail, souvent sur un autre appareil que celui où l'on
 * est connecté. Exiger une connexion ferait perdre la moitié des réponses.
 *
 * Le jeton ne porte que l'identifiant de la campagne ; c'est elle qui désigne
 * le compte. Personne ne peut donc répondre au nom d'un autre sans détenir son
 * lien, et un lien volé ne donne accès à rien d'autre que ce formulaire.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySatisfactionToken } from "@/lib/satisfaction/token";

export const runtime = "nodejs";

/** Coupe proprement, sans tronquer au milieu d'un mot si on peut l'éviter. */
function trim(value: unknown, max = 2000): string | null {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const token = String(body.token ?? "");
  const claim = verifySatisfactionToken(token);
  if (!claim) {
    return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 401 });
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Merci d'indiquer une note de 1 à 5." }, { status: 400 });
  }

  const npsRaw = Number(body.nps);
  const nps = Number.isInteger(npsRaw) && npsRaw >= 0 && npsRaw <= 10 ? npsRaw : null;

  const campaign = await prisma.satisfactionCampaign.findUnique({
    where: { id: claim.campaignId },
    select: { id: true, userId: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 404 });
  }

  // `upsert` : revenir sur le formulaire corrige sa réponse au lieu d'en
  // empiler une seconde. La contrainte d'unicité sur `campaignId` rend le
  // doublon impossible même si deux onglets répondent en même temps.
  await prisma.satisfactionResponse.upsert({
    where: { campaignId: campaign.id },
    create: {
      campaignId: campaign.id,
      userId: campaign.userId,
      rating,
      nps,
      likes: trim(body.likes),
      improvements: trim(body.improvements),
      wishedFeature: trim(body.wishedFeature),
    },
    update: {
      rating,
      nps,
      likes: trim(body.likes),
      improvements: trim(body.improvements),
      wishedFeature: trim(body.wishedFeature),
    },
  });

  return NextResponse.json({ ok: true });
}

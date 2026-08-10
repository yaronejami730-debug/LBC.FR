import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth-unified";
import { prisma } from "@/lib/prisma";

/**
 * Abonnement à un vendeur.
 *
 * Gratuit, unilatéral, réversible : le vendeur n'a rien à accepter et n'est
 * pas prévenu de la liste de ses abonnés. Aucun email n'est envoyé au moment
 * de l'abonnement — les nouvelles annonces partent groupées
 * (cf. /api/cron/subscription-digest).
 */
export async function POST(req: NextRequest) {
  const viewerId = await getAuthUserId(req);
  if (!viewerId) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });

  const { sellerId } = await req.json().catch(() => ({}));
  if (!sellerId || typeof sellerId !== "string") {
    return NextResponse.json({ error: "Vendeur manquant" }, { status: 400 });
  }
  if (sellerId === viewerId) {
    return NextResponse.json({ error: "Impossible de s'abonner à soi-même" }, { status: 400 });
  }

  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { id: true, bannedAt: true },
  });
  if (!seller || seller.bannedAt) {
    return NextResponse.json({ error: "Vendeur introuvable" }, { status: 404 });
  }

  const existing = await prisma.subscription.findUnique({
    where: { followerId_sellerId: { followerId: viewerId, sellerId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.subscription.delete({ where: { id: existing.id } });
    return NextResponse.json({ subscribed: false });
  }

  await prisma.subscription.create({
    data: {
      followerId: viewerId,
      sellerId,
      // Point de départ : seules les annonces publiées *après* l'abonnement
      // sont annoncées. Personne ne veut recevoir tout l'historique.
      lastNotifiedAt: new Date(),
    },
  });

  return NextResponse.json({ subscribed: true });
}

/** État de l'abonnement courant + nombre d'abonnés du vendeur. */
export async function GET(req: NextRequest) {
  const sellerId = req.nextUrl.searchParams.get("sellerId");
  if (!sellerId) return NextResponse.json({ error: "Vendeur manquant" }, { status: 400 });

  const viewerId = await getAuthUserId(req);
  const [count, mine] = await Promise.all([
    prisma.subscription.count({ where: { sellerId } }),
    viewerId
      ? prisma.subscription.findUnique({
          where: { followerId_sellerId: { followerId: viewerId, sellerId } },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({ subscribed: !!mine, count });
}

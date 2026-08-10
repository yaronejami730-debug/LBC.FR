import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";
import { getUserResponseTime } from "@/lib/user-stats";

export const dynamic = "force-dynamic";

/** Filtre public canonique : ce qu'un visiteur a le droit de voir. */
const PUBLIC_LISTING = { status: "APPROVED" as const, deletedAt: null, shadowBanned: false };

const PAGE_SIZE = 24;

/**
 * Profil vendeur public — identité, réputation et annonces en ligne.
 *
 * Sert l'écran mobile /vendeur/[id] et reprend ce qu'affiche la page web
 * /u/[id]. Accepte la session NextAuth comme le Bearer mobile : sans
 * authentification la réponse est identique, `subscribed` vaut simplement
 * false.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? 1) || 1);

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, avatar: true, verified: true,
      isPro: true, companyName: true, createdAt: true, bannedAt: true,
    },
  });

  // Un compte banni n'existe plus pour le public : même réponse qu'un id inconnu.
  if (!user || user.bannedAt) {
    return NextResponse.json({ error: "Vendeur introuvable" }, { status: 404 });
  }

  const viewerId = await getAuthUserId(req);

  const [listings, listingsCount, subscriberCount, mySubscription, responseTime] =
    await Promise.all([
      prisma.listing.findMany({
        where: { userId: id, ...PUBLIC_LISTING },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true, title: true, price: true, location: true,
          images: true, createdAt: true, isPremium: true,
        },
      }),
      prisma.listing.count({ where: { userId: id, ...PUBLIC_LISTING } }),
      prisma.subscription.count({ where: { sellerId: id } }),
      viewerId
        ? prisma.subscription.findUnique({
            where: { followerId_sellerId: { followerId: viewerId, sellerId: id } },
            select: { id: true },
          })
        : Promise.resolve(null),
      getUserResponseTime(id).catch(() => null),
    ]);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      companyName: user.companyName,
      isPro: user.isPro,
      avatar: user.avatar,
      verified: user.verified,
      memberSince: user.createdAt.toISOString(),
      listingsCount,
      responseTime,
      subscriberCount,
      subscribed: !!mySubscription,
      isMe: viewerId === user.id,
    },
    listings,
    page,
    hasMore: page * PAGE_SIZE < listingsCount,
  });
}

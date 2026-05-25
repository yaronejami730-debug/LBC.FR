import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";
import { sendPushNotification } from "@/lib/notifications/send";
import { isEmailAllowed } from "@/lib/notifications/preferences";
import { sendEmail } from "@/lib/email";
import { newFavoriteEmail } from "@/lib/emails/new-favorite";

// Prévient le propriétaire de l'annonce (push + email) qu'elle a été mise en
// favori. Fire-and-forget : ne bloque jamais la réponse. Jamais d'auto-favori.
async function notifyOwner(listingId: string, favoritedBy: string): Promise<void> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      title: true,
      userId: true,
      user: { select: { email: true, name: true } },
    },
  });
  if (!listing || listing.userId === favoritedBy) return;

  // Push (respecte les préférences via sendPushNotification)
  sendPushNotification({
    userId: listing.userId,
    template: "listing_favorited",
    variables: { listingTitle: listing.title, listingId: listing.id },
  }).catch(() => {});

  // Email (respecte la préférence "favorites" / email)
  if (listing.user.email && (await isEmailAllowed(listing.userId, "favorites"))) {
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
    sendEmail({
      to: listing.user.email,
      toName: listing.user.name,
      subject: "Votre annonce a été mise en favori — Deal & Co",
      adSource: "new-favorite",
      userId: listing.userId,
      html: newFavoriteEmail({
        name: listing.user.name ?? "",
        listingTitle: listing.title,
        listingUrl: `${baseUrl}/annonce/${listing.id}`,
      }),
    }).catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listingId } = await req.json();
  if (!listingId) return NextResponse.json({ error: "Missing listingId" }, { status: 400 });

  // Détecte le NOUVEAU favori pour ne notifier qu'une fois (pas de spam au re-POST).
  const existing = await prisma.favorite.findUnique({
    where: { userId_listingId: { userId, listingId } },
    select: { id: true },
  });

  await prisma.favorite.upsert({
    where: { userId_listingId: { userId, listingId } },
    create: { userId, listingId },
    update: {},
  });

  if (!existing) {
    notifyOwner(listingId, userId).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listingId } = await req.json();
  await prisma.favorite.deleteMany({
    where: { userId, listingId },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const favorites = await prisma.favorite.findMany({
    where: { userId },
    include: {
      listing: { include: { user: { select: { name: true, verified: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(favorites);
}

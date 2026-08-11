import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthUserId } from "@/lib/auth-unified";
import { prisma } from "@/lib/prisma";
import { onListingUpdated, onListingRemoved } from "@/lib/seo/lifecycle";
import { sendPushNotification } from "@/lib/notifications/send";
import { listingSlug } from "@/lib/listing-slug";
import { indexListing, deleteListingFromIndex } from "@/lib/opensearch-sync";
import { sanitizeLocation, addressLineFor } from "@/lib/listing-location";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true, name: true, avatar: true, verified: true,
          isPro: true, companyName: true, createdAt: true,
        },
      },
      _count: { select: { favorites: true } },
    },
  });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sellerTotal = await prisma.listing.count({
    where: { userId: listing.userId, status: "APPROVED", deletedAt: null },
  });

  prisma.listing
    .update({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  return NextResponse.json({
    ...listing,
    favoritesCount: listing._count.favorites,
    user: {
      ...listing.user,
      memberSince: listing.user.createdAt.toISOString(),
      listingsCount: sellerTotal,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Une annonce dont le délai de conservation est écoulé n'est plus
  // modifiable : elle est en attente de destruction, la remettre en file
  // reviendrait à la ressusciter au moment où on s'apprête à l'effacer.
  const expired =
    !!listing.permanentDeletionAt && listing.permanentDeletionAt.getTime() <= Date.now();
  if (expired) {
    return NextResponse.json(
      { error: "Le délai de modification de cette annonce est écoulé." },
      { status: 409 },
    );
  }

  const body = await req.json();
  const { title, price, description, location: rawLocation, condition, images, category, subcategory, metadata } = body;

  // La casquette de l'annonce ne change pas à la modification : elle a été
  // fixée à la publication. La règle d'adresse la suit, sinon une annonce
  // particulière rééditée pourrait ressortir avec une adresse complète.
  const postedAs = listing.postedAs === "PRO" ? "PRO" : "PARTICULIER";
  const location =
    rawLocation === undefined ? undefined : sanitizeLocation(String(rawLocation), postedAs);
  const addressLine =
    rawLocation === undefined ? undefined : addressLineFor(String(rawLocation), postedAs);

  if (location !== undefined && location.length < 2) {
    return NextResponse.json(
      { error: "Indiquez au moins une ville ou une commune." },
      { status: 400 },
    );
  }

  // Une annonce retirée qui repart en modération conserve son échéance : sans
  // ça, le cycle modifier → refuser → modifier repousserait la suppression
  // indéfiniment. Elle remonte en revanche en tête de file, parce qu'un
  // contenu déjà sanctionné mérite d'être revu vite.
  const wasSanctioned =
    listing.status === "REMOVED" ||
    listing.status === "REJECTED" ||
    // Mise en revue : ce n'est pas une sanction, mais la correction demandée
    // doit être relue vite — c'est nous qui avons mis l'annonce en pause.
    listing.status === "UNDER_REVIEW";

  const updated = await prisma.listing.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(description !== undefined && { description }),
      ...(location !== undefined && { location }),
      ...(addressLine !== undefined && { addressLine }),
      ...(condition !== undefined && { condition }),
      ...(images !== undefined && { images: JSON.stringify(images) }),
      ...(category !== undefined && { category }),
      ...(subcategory !== undefined && { subcategory }),
      ...(metadata !== undefined && { metadata }),
      status: "PENDING",
      ...(wasSanctioned && { reviewPriority: 100, shadowBanned: false }),
    },
  });

  if (wasSanctioned) {
    prisma.moderationEvent
      .create({
        data: {
          listingId: id,
          userId,
          actor: "system",
          action: "listing_resubmitted",
          reason: "Annonce corrigée par son auteur après retrait ou refus",
        },
      })
      .catch(() => {});
  }

  // Resynchronise l'index OpenSearch — fire-and-forget. Une annonce en attente
  // n'est pas indexable : `listingToDocument` s'appuie sur le statut.
  indexListing(updated).catch((err) =>
    console.error("[OpenSearch] indexListing (PATCH) échec:", err),
  );

  // Recalcule le verdict SEO : une modification peut faire entrer l'annonce
  // dans l'index (photos ajoutées) comme l'en faire sortir (texte raccourci).
  onListingUpdated(id).catch(() => {});

  sendPushNotification({
    userId: updated.userId,
    template: "listing_pending",
    variables: { listingTitle: updated.title, listingId: updated.id },
  }).catch(() => {});

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.listing.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  // Retire l'annonce de l'index OpenSearch — fire-and-forget.
  deleteListingFromIndex(id).catch((err) =>
    console.error("[OpenSearch] deleteListingFromIndex échec:", err),
  );

  // L'URL sort du sitemap et passe en GONE dans la file. Pas de ping IndexNow :
  // la page répond désormais 404, ce qui est le signal correct et suffisant.
  onListingRemoved(id).catch(() => {});

  return NextResponse.json({ success: true });
}

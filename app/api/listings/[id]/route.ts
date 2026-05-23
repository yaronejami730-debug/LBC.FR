import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthUserId } from "@/lib/auth-unified";
import { prisma } from "@/lib/prisma";
import { pingIndexNow } from "@/lib/indexnow";
import { listingSlug } from "@/lib/listing-slug";
import { indexListing, deleteListingFromIndex } from "@/lib/opensearch-sync";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(listing);
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

  const body = await req.json();
  const { title, price, description, location, condition, images, category, subcategory, metadata } = body;

  const updated = await prisma.listing.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(description !== undefined && { description }),
      ...(location !== undefined && { location }),
      ...(condition !== undefined && { condition }),
      ...(images !== undefined && { images: JSON.stringify(images) }),
      ...(category !== undefined && { category }),
      ...(subcategory !== undefined && { subcategory }),
      ...(metadata !== undefined && { metadata }),
      status: "PENDING",
    },
  });

  // Resynchronise l'index OpenSearch — fire-and-forget.
  indexListing(updated).catch((err) =>
    console.error("[OpenSearch] indexListing (PATCH) échec:", err),
  );

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

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
  pingIndexNow([`${baseUrl}/annonce/${id}/${listingSlug(listing.title)}`]).catch(() => {});

  return NextResponse.json({ success: true });
}

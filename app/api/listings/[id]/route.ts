import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.listing.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}

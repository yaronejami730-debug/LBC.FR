import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listingId } = await req.json();
  if (!listingId) return NextResponse.json({ error: "Missing listingId" }, { status: 400 });

  await prisma.favorite.upsert({
    where: { userId_listingId: { userId, listingId } },
    create: { userId, listingId },
    update: {},
  });

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

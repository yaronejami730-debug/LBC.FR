import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listingId, sellerId } = await req.json();
  const buyerId = session.user.id;

  if (buyerId === sellerId) {
    return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
  }

  // Find existing conversation with exactly these two participants
  const existing = await prisma.conversation.findFirst({
    where: {
      listingId,
      AND: [
        { participants: { some: { userId: buyerId } } },
        { participants: { some: { userId: sellerId } } },
      ],
    },
    include: { participants: true },
  });

  if (existing) {
    return NextResponse.json(existing);
  }

  // Create new conversation
  const conversation = await prisma.conversation.create({
    data: {
      listingId,
      participants: {
        create: [{ userId: buyerId }, { userId: sellerId }],
      },
    },
  });

  return NextResponse.json(conversation, { status: 201 });
}

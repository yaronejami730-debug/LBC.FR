import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId } },
    },
    include: {
      listing: { select: { id: true, title: true, price: true, images: true } },
      participants: {
        include: {
          user: { select: { id: true, name: true, avatar: true, verified: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const result = conversations.map((conv) => {
    const lastMessage = conv.messages[0] ?? null;
    const unread = lastMessage
      ? !lastMessage.read && lastMessage.senderId !== userId
      : false;

    return {
      id: conv.id,
      updatedAt: conv.updatedAt.toISOString(),
      listing: {
        id: conv.listing.id,
        title: conv.listing.title,
        price: conv.listing.price,
        images: conv.listing.images,
      },
      participants: conv.participants.map((p) => ({
        userId: p.userId,
        user: p.user,
      })),
      lastMessage: lastMessage
        ? {
            content: lastMessage.content,
            createdAt: lastMessage.createdAt.toISOString(),
            senderId: lastMessage.senderId,
            read: lastMessage.read,
          }
        : null,
      unread,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listingId, sellerId } = await req.json();
  const buyerId = userId;

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

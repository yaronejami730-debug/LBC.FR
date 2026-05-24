import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const conv = await prisma.conversation.findFirst({
    where: {
      id,
      participants: { some: { userId } },
    },
    include: {
      listing: { select: { id: true, title: true, price: true, images: true } },
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
              verified: true,
              lastLoginAt: true,
            },
          },
        },
      },
    },
  });

  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
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
      user: {
        id: p.user.id,
        name: p.user.name,
        avatar: p.user.avatar,
        verified: p.user.verified,
        lastLoginAt: p.user.lastLoginAt ? p.user.lastLoginAt.toISOString() : null,
      },
    })),
  });
}

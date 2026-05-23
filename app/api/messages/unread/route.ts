import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ count: 0 });
  }

  const count = await prisma.message.count({
    where: {
      read: false,
      senderId: { not: userId },
      conversation: {
        participants: { some: { userId } },
      },
    },
  });

  return NextResponse.json({ count });
}

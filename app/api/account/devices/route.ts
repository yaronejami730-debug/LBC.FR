import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const sessions = await prisma.deviceSession.findMany({
    where: { userId },
    orderBy: { lastSeenAt: "desc" },
    take: 20,
    select: { id: true, firstSeenAt: true, lastSeenAt: true },
  });

  return NextResponse.json(
    sessions.map((s) => ({
      id: s.id,
      firstSeenAt: s.firstSeenAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
    })),
  );
}

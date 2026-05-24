import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Retourne UNE pub interstitielle active (plein écran modal) si disponible.
export async function GET() {
  const now = new Date();
  const ad = await prisma.advertisement.findFirst({
    where: {
      isInterstitial: true,
      isActive: true,
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, description: true,
      imageUrl: true, imageUrlWide: true, destinationUrl: true,
    },
  });
  return NextResponse.json(ad);
}

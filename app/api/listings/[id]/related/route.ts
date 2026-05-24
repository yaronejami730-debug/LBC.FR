import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Renvoie : { sellerOthers: [...], similar: [...] }
// - sellerOthers : autres annonces du même vendeur (10 max)
// - similar     : annonces de la même catégorie / sous-catégorie (10 max)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ref = await prisma.listing.findUnique({
    where: { id },
    select: { userId: true, category: true, subcategory: true },
  });
  if (!ref) return NextResponse.json({ sellerOthers: [], similar: [] });

  const baseSelect = {
    id: true, title: true, price: true, location: true,
    images: true, createdAt: true, isPremium: true,
  };

  const [sellerOthers, similar] = await Promise.all([
    prisma.listing.findMany({
      where: {
        userId: ref.userId,
        status: "APPROVED",
        deletedAt: null,
        id: { not: id },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: baseSelect,
    }),
    prisma.listing.findMany({
      where: {
        status: "APPROVED",
        deletedAt: null,
        id: { not: id },
        userId: { not: ref.userId },
        category: ref.category,
        ...(ref.subcategory ? { subcategory: ref.subcategory } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: baseSelect,
    }),
  ]);

  return NextResponse.json({ sellerOthers, similar });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const listings = await prisma.listing.findMany({
    where: {
      status: "APPROVED",
      deletedAt: null,
      title: { contains: q, mode: "insensitive" },
    } as any,
    select: { id: true, title: true, price: true, category: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  return NextResponse.json(listings);
}

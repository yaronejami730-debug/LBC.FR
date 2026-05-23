import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = 20;
  const statusParam = searchParams.get("status");

  const where: Record<string, unknown> = { userId, deletedAt: null };
  if (statusParam) where.status = statusParam;

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        title: true,
        price: true,
        category: true,
        location: true,
        images: true,
        status: true,
        views: true,
        createdAt: true,
      },
    }),
    prisma.listing.count({ where }),
  ]);

  return NextResponse.json({ listings, total, page, perPage });
}

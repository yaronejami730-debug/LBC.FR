import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = 20;
  const statusParam = searchParams.get("status");
  const expiredOnly = searchParams.get("expired") === "1";

  const now = new Date();
  const where: Record<string, unknown> = { userId, deletedAt: null };
  if (statusParam) where.status = statusParam;
  if (expiredOnly) where.expiresAt = { lt: now };

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
        viewCount: true,
        phoneClickCount: true,
        messageClickCount: true,
        expiresAt: true,
        createdAt: true,
        _count: { select: { favorites: true } },
      },
    }),
    prisma.listing.count({ where }),
  ]);

  const result = listings.map((l) => ({
    id: l.id,
    title: l.title,
    price: l.price,
    category: l.category,
    location: l.location,
    images: l.images,
    status: l.status,
    views: l.viewCount,
    phoneClicks: l.phoneClickCount,
    messageClicks: l.messageClickCount,
    favoritesCount: l._count.favorites,
    expiresAt: l.expiresAt ? l.expiresAt.toISOString() : null,
    isExpired: l.expiresAt ? l.expiresAt < now : false,
    createdAt: l.createdAt.toISOString(),
  }));

  return NextResponse.json({ listings: result, total, page, perPage });
}

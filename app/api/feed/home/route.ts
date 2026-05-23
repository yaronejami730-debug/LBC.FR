import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const LISTING_SELECT = {
  id: true,
  title: true,
  price: true,
  location: true,
  images: true,
  createdAt: true,
  isPremium: true,
  category: true,
} as const;

const APPROVED = { status: "APPROVED" as const, deletedAt: null, shadowBanned: false };

function dedupeRows<T extends { id: string }>(rows: T[][]): T[][] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const out: T[] = [];
    for (const l of row) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      out.push(l);
    }
    return out;
  });
}

export async function GET() {
  try {
    const [featured, bargains, vehicules, immobilier, mode, recents] = await Promise.all([
      prisma.listing.findMany({
        where: { ...APPROVED, OR: [{ isPremium: true }, { isVerified: true }, { user: { isPro: true } }] },
        orderBy: [{ isPremium: "desc" }, { createdAt: "desc" }],
        take: 10,
        select: LISTING_SELECT,
      }),
      prisma.listing.findMany({
        where: { ...APPROVED, price: { gt: 0, lte: 100 } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: LISTING_SELECT,
      }),
      prisma.listing.findMany({
        where: { ...APPROVED, category: "vehicules" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: LISTING_SELECT,
      }),
      prisma.listing.findMany({
        where: { ...APPROVED, category: "immobilier" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: LISTING_SELECT,
      }),
      prisma.listing.findMany({
        where: { ...APPROVED, category: "mode" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: LISTING_SELECT,
      }),
      prisma.listing.findMany({
        where: APPROVED,
        orderBy: { createdAt: "desc" },
        take: 12,
        select: LISTING_SELECT,
      }),
    ]);

    const [f, b, v, i, m, r] = dedupeRows([featured, bargains, vehicules, immobilier, mode, recents]);

    return NextResponse.json({
      featured: f, bargains: b, vehicules: v, immobilier: i, mode: m, recents: r,
    });
  } catch (err) {
    console.error("[GET /api/feed/home]", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";
import { buildSearchWhere } from "@/lib/search-where";

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searches = await prisma.savedSearch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  // Count matching listings for each saved search
  const withCounts = await Promise.all(
    searches.map(async (s) => {
      const filters = JSON.parse(s.filters) as Record<string, string>;
      const count = await prisma.listing.count({
        where: buildSearchWhere(filters, { includeNonApproved: true }) as any,
      });
      return { ...s, matchCount: count };
    })
  );

  return NextResponse.json(withCounts);
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, filters } = body as { name: string; filters: Record<string, unknown> };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    }

    const saved = await prisma.savedSearch.create({
      data: {
        userId,
        name: name.trim(),
        filters: JSON.stringify(filters || {}),
      },
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    console.error("[POST /api/saved-searches]", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

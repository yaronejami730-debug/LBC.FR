import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ listings: [], categories: [] });

  // Échapper les caractères spéciaux pour tsquery
  const tsQuery = q
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, "") + ":*")
    .filter(Boolean)
    .join(" & ");

  // Full-text search PostgreSQL avec ranking + fallback ILIKE
  const [listingsRaw, categories] = await Promise.all([
    tsQuery
      ? prisma.$queryRaw<
          { id: string; title: string; price: number; category: string; images: string; rank: number }[]
        >`
          SELECT id, title, price, category, images,
            ts_rank(to_tsvector('french', title || ' ' || description), to_tsquery('french', ${tsQuery})) AS rank
          FROM "Listing"
          WHERE status = 'APPROVED'
            AND "deletedAt" IS NULL
            AND (
              to_tsvector('french', title || ' ' || description) @@ to_tsquery('french', ${tsQuery})
              OR title ILIKE ${"%" + q + "%"}
            )
          ORDER BY rank DESC, "createdAt" DESC
          LIMIT 6
        `
      : Promise.resolve([]),

    // Catégories qui matchent
    prisma.listing.groupBy({
      by: ["category"],
      where: {
        status: "APPROVED",
        deletedAt: null,
        category: { contains: q, mode: "insensitive" },
      } as any,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 3,
    }),
  ]);

  const listings = listingsRaw.map((l) => {
    let img: string | null = null;
    try { img = (JSON.parse(l.images) as string[])[0] ?? null; } catch { /* */ }
    return { id: l.id, title: l.title, price: l.price, category: l.category, image: img };
  });

  return NextResponse.json({
    listings,
    categories: categories.map((c) => ({ name: c.category, count: c._count.id })),
  });
}

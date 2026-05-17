/**
 * GET /api/search/suggestions?q=…
 *
 * Autocomplétion de la barre de recherche :
 *   - top 6 annonces correspondant à la requête
 *   - top 3 catégories
 *
 * OpenSearch si configuré (préfixe + fuzzy + synonymes via fr_search),
 * sinon repli PostgreSQL plein-texte (comportement historique).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOpenSearchEnabled } from "@/lib/opensearch";
import { suggestListings } from "@/lib/opensearch-search";

type SuggestionListing = {
  id: string;
  title: string;
  price: number;
  category: string;
  image: string | null;
};

function firstImage(raw: string): string | null {
  try {
    return (JSON.parse(raw) as string[])[0] ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ listings: [], categories: [] });

  // ── Voie OpenSearch ───────────────────────────────────────
  if (isOpenSearchEnabled()) {
    try {
      const { ids, categories } = await suggestListings(q);
      const rows = ids.length
        ? await prisma.listing.findMany({
            where: { id: { in: ids } },
            select: { id: true, title: true, price: true, category: true, images: true },
          })
        : [];
      const byId = new Map(rows.map((r) => [r.id, r]));
      const listings: SuggestionListing[] = ids
        .map((id) => byId.get(id))
        .filter((r): r is NonNullable<typeof r> => Boolean(r))
        .map((r) => ({
          id: r.id,
          title: r.title,
          price: r.price,
          category: r.category,
          image: firstImage(r.images),
        }));
      return NextResponse.json({ listings, categories });
    } catch (err) {
      console.error("[GET /api/search/suggestions] OpenSearch KO, repli PostgreSQL:", err);
    }
  }

  // ── Repli PostgreSQL plein-texte ──────────────────────────
  const tsQuery = q
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[^a-zA-Z0-9À-ɏ]/g, "") + ":*")
    .filter(Boolean)
    .join(" & ");

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

    prisma.listing.groupBy({
      by: ["category"],
      where: {
        status: "APPROVED",
        deletedAt: null,
        category: { contains: q, mode: "insensitive" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 3,
    }),
  ]);

  const listings: SuggestionListing[] = listingsRaw.map((l) => ({
    id: l.id,
    title: l.title,
    price: l.price,
    category: l.category,
    image: firstImage(l.images),
  }));

  return NextResponse.json({
    listings,
    categories: categories.map((c) => ({ name: c.category, count: c._count.id })),
  });
}

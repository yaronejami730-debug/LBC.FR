import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";

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

const EMPTY = { recentSearches: [], recentlyViewed: [], suggestions: [], suggestionLabel: null };

// Home perso : reprend les events `listing_view` / `search` de l'utilisateur
// pour produire « reprendre vos recherches », « récemment vu » et
// « suggestions » (catégorie/sous-catégorie la plus consultée).
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json(EMPTY);

  const events = await prisma.userEvent.findMany({
    where: { userId, kind: { in: ["listing_view", "search"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { kind: true, meta: true },
  });

  const recentSearches: string[] = [];
  const seenQ = new Set<string>();
  const viewedIds: string[] = [];
  const seenId = new Set<string>();
  const catCount = new Map<string, number>();
  const subCount = new Map<string, number>();

  for (const e of events) {
    if (!e.meta) continue;
    let m: Record<string, unknown>;
    try { m = JSON.parse(e.meta); } catch { continue; }

    if (e.kind === "search") {
      const q = typeof m.q === "string" ? m.q.trim() : "";
      if (q && !seenQ.has(q.toLowerCase()) && recentSearches.length < 8) {
        seenQ.add(q.toLowerCase());
        recentSearches.push(q);
      }
    } else if (e.kind === "listing_view") {
      const id = typeof m.listingId === "string" ? m.listingId : null;
      if (id && !seenId.has(id)) { seenId.add(id); viewedIds.push(id); }
      if (typeof m.category === "string" && m.category) catCount.set(m.category, (catCount.get(m.category) ?? 0) + 1);
      if (typeof m.subcategory === "string" && m.subcategory) subCount.set(m.subcategory, (subCount.get(m.subcategory) ?? 0) + 1);
    }
  }

  const topViewed = viewedIds.slice(0, 12);

  // Récemment vu : on ne garde que les annonces encore en ligne, ordre préservé.
  const viewedRows = topViewed.length
    ? await prisma.listing.findMany({ where: { id: { in: topViewed }, ...APPROVED }, select: LISTING_SELECT })
    : [];
  const byId = new Map(viewedRows.map((l) => [l.id, l]));
  const recentlyViewed = topViewed.map((id) => byId.get(id)).filter(Boolean);

  // Suggestions : sous-catégorie dominante (signal ≥2) sinon catégorie dominante.
  const topSub = [...subCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const topCat = [...catCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const useSub = Boolean(topSub && topSub[1] >= 2);
  const filterValue = useSub ? topSub[0] : topCat?.[0] ?? null;
  const catFilter = useSub ? { subcategory: filterValue } : { category: filterValue ?? "" };

  let suggestions: typeof viewedRows = [];
  if (filterValue) {
    suggestions = await prisma.listing.findMany({
      where: { ...APPROVED, ...catFilter, id: { notIn: topViewed.length ? topViewed : ["_none_"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: LISTING_SELECT,
    });
  }

  return NextResponse.json({
    recentSearches,
    recentlyViewed,
    suggestions,
    suggestionLabel: filterValue,
  });
}

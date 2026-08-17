import { Fragment } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getActiveAds } from "@/lib/ads";
import Navbar from "@/components/Navbar";
import { CATEGORIES } from "@/lib/categories";
import { buildSearchWhere } from "@/lib/search-where";
import SearchBar from "./SearchBar";
import HistoryTracker from "@/components/HistoryTracker";
import GridAdCard from "@/components/GridAdCard";
import AdSlot from "@/components/ads/AdSlot";
import { adPositions } from "@/lib/ads/rhythm";
import ListingCard from "@/components/home/ListingCard";
import { Suspense } from "react";
import SaveSearchButton from "./SaveSearchButton";
import { parsePageParam } from "@/lib/pagination";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const q = params.q || "";
  const category = params.category || "";
  const location = params.location || "";

  let title = "Toutes les annonces";
  let description =
    "Parcourez toutes les petites annonces gratuites sur Deal&Co. Voitures, immobilier, mode, électronique et bien plus entre particuliers en France.";

  if (category && q) {
    title = `${q} en ${category} — Annonces gratuites`;
    description = `Trouvez "${q}" dans la catégorie ${category} sur Deal&Co. Petites annonces gratuites entre particuliers${location ? ` à ${location}` : " en France"}.`;
  } else if (category) {
    title = `Annonces ${category}${location ? ` à ${location}` : ""}`;
    description = `Parcourez toutes les annonces ${category} sur Deal&Co${location ? ` à ${location}` : " en France"}. Achetez et vendez entre particuliers gratuitement.`;
  } else if (q) {
    title = `"${q}" — Petites annonces`;
    description = `${
      (await prisma.listing.count({ where: { status: "APPROVED", deletedAt: null, OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } as any }).catch(() => 0))
    } annonces trouvées pour "${q}" sur Deal&Co. Achetez et vendez entre particuliers gratuitement.`;
  }

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.dealandcompany.fr/search${category ? `?category=${encodeURIComponent(category)}` : q ? `?q=${encodeURIComponent(q)}` : ""}`,
    },
    // Aucune variante de `/search` n'entre dans l'index, filtres ou non.
    //
    // Les vues filtrées dupliquent `/annonces/{cat}` et `/ville/{slug}`. La vue
    // nue, elle, est une page de résultats de recherche interne : Google demande
    // explicitement de ne pas les indexer, et `/annonces` couvre déjà la même
    // intention avec un contenu éditorialisé et un maillage propre.
    //
    // `follow` reste actif : la page reste un point de passage utile pour
    // atteindre les annonces.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const q        = params.q        || "";
  const category = params.category || "";
  // Même défaut que partout ailleurs : un `?page=` illisible vaut page 1.
  // `parseInt("abc")` valait `NaN`, qui se propageait jusqu'au `skip` de Prisma
  // et faisait répondre 500.
  const page     = parsePageParam(params.page);
  const sort     = params.sort     || "";
  const perPage  = 12;

  const orderBy =
    sort === "Prix croissant"  ? { price: "asc" as const } :
    sort === "Prix décroissant" ? { price: "desc" as const } :
    sort === "Plus anciennes"  ? { createdAt: "asc" as const } :
                                  { createdAt: "desc" as const };

  const where = buildSearchWhere(params);

  const [listings, total, ads] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: { select: { verified: true } } },
    }),
    prisma.listing.count({ where }),
    getActiveAds(3).catch(() => []),
  ]);

  const totalPages = Math.ceil(total / perPage);

  // Cadence irrégulière — 5, 7, 10, 6 cartes — et décalée d'une page à l'autre :
  // un encart toujours à la même position finit par être sauté d'office.
  const adSlots = adPositions(listings.length, page);

  const activeCategory = category || "All";

  return (
    <div className="bg-background text-on-surface">
      <Navbar active="recherche" />
      {/* Track the active category for homepage recommendations */}
      {category && <HistoryTracker category={category} />}

      <main className="pt-32 pb-32 px-6 max-w-7xl mx-auto">
        {/* Filter Bar */}
        <section className="mb-12">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">Découvrez les articles</span>
                <h1 className="text-3xl font-extrabold manrope text-primary tracking-tight">Annonces sélectionnées</h1>
              </div>
              <div className="flex items-center gap-3">
                <Suspense>
                  <SaveSearchButton />
                </Suspense>
                <SearchBar q={q} category={category} searchParams={params} />
              </div>
            </div>
            {/* Chips/Filters */}
            <div className="flex flex-wrap gap-2">
              <Link
                href="/search"
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                  activeCategory === "All"
                    ? "bg-primary text-white shadow-lg"
                    : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant/10 hover:bg-slate-50"
                }`}
              >
                Toutes
              </Link>
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/search?category=${encodeURIComponent(cat.label)}${q ? `&q=${q}` : ""}`}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                    activeCategory === cat.label
                      ? "bg-primary text-white shadow-lg shadow-primary/20"
                      : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant/10 hover:bg-slate-50"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{cat.icon}</span>
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Listings Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {listings.length === 0 ? (
            <div className="col-span-5 py-24 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-5xl block mb-4">search_off</span>
              <p className="text-lg font-semibold">Aucune annonce trouvée</p>
              <p className="text-sm mt-1">Essayez une autre recherche ou catégorie</p>
            </div>
          ) : (
            listings.map((listing, i) => {
              const adIndex = Math.floor(i / 5);
              const ad = adSlots.has(i) ? ads[adIndex % Math.max(ads.length, 1)] ?? null : null;
              return (
                <Fragment key={listing.id}>
                  {/* Une case sur cinq du fil : au format d'une annonce, mais
                      badgée « Publicité ». Se fondre est le but, tromper ne
                      l'est pas. */}
                  {adSlots.has(i) && (
                    <AdSlot
                      placement="SEARCH_GRID"
                      variant="card"
                      city={params.location ?? null}
                      category={params.category ?? null}
                      fallback={
                        ad ? (
                          <GridAdCard
                            id={ad.id}
                            title={ad.title}
                            description={ad.description}
                            imageUrl={ad.imageUrl}
                            destinationUrl={ad.destinationUrl}
                          />
                        ) : null
                      }
                    />
                  )}
                  <ListingCard listing={listing} priority={i === 0} />
                </Fragment>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-20 flex justify-center">
            <div className="flex items-center bg-surface-container-low p-1.5 rounded-full">
              {(() => {
                const { page: _p, _filters: _f, ...restParams } = params;
                const baseParams = restParams;
                return (
                  <>
                    {page > 1 && (
                      <Link href={`/search?${new URLSearchParams({ ...baseParams, page: String(page - 1) })}`} className="w-10 h-10 flex items-center justify-center rounded-full text-primary hover:bg-white transition-all">
                        <span className="material-symbols-outlined">chevron_left</span>
                      </Link>
                    )}
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                      <Link
                        key={p}
                        href={`/search?${new URLSearchParams({ ...baseParams, page: String(p) })}`}
                        className={`w-10 h-10 flex items-center justify-center rounded-full font-medium text-sm hover:bg-white transition-all ${p === page ? "bg-primary text-white font-bold shadow-md" : "text-on-surface-variant"}`}
                      >
                        {p}
                      </Link>
                    ))}
                    {page < totalPages && (
                      <Link href={`/search?${new URLSearchParams({ ...baseParams, page: String(page + 1) })}`} className="w-10 h-10 flex items-center justify-center rounded-full text-primary hover:bg-white transition-all">
                        <span className="material-symbols-outlined">chevron_right</span>
                      </Link>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

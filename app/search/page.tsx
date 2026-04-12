import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDistanceToNow } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const category = params.category || "";
  const page = parseInt(params.page || "1");
  const perPage = 12;

  const where = {
    ...(q && {
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
        { location: { contains: q } },
      ],
    }),
    ...(category && { category }),
  };

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: { select: { verified: true } } },
    }),
    prisma.listing.count({ where }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  const activeCategory = category || "All";

  return (
    <div className="bg-background text-on-surface">
      <Navbar active="recherche" />

      <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto">
        {/* Filter Bar */}
        <section className="mb-12">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-secondary">Découvrez les articles</span>
                <h2 className="text-3xl font-extrabold manrope text-primary tracking-tight">Annonces sélectionnées</h2>
              </div>
              <form action="/search" method="get" className="flex items-center bg-surface-container-lowest px-4 py-2 rounded-xl shadow-[0_8px_24px_rgba(21,21,125,0.04)] w-full md:w-96 group">
                {category && <input type="hidden" name="category" value={category} />}
                <span className="material-symbols-outlined text-outline-variant group-focus-within:text-primary transition-colors">search</span>
                <input defaultValue={q} name="q" className="bg-transparent border-none focus:ring-0 text-sm w-full ml-2 outline-none" placeholder="Rechercher..." type="text" />
              </form>
            </div>
            {/* Chips/Filters */}
            <div className="flex flex-wrap gap-3">
              {["Électronique", "Véhicules", "Meubles", "Immobilier", "Mode", "Emplois"].map((cat) => (
                <Link
                  key={cat}
                  href={`/search?category=${cat}${q ? `&q=${q}` : ""}`}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-transform active:scale-95 ${
                    activeCategory === cat
                      ? "bg-primary text-white shadow-lg shadow-primary/20"
                      : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant/15 hover:bg-surface-container-low"
                  }`}
                >
                  {cat}
                </Link>
              ))}
              <button className="flex items-center gap-2 px-5 py-2.5 bg-tertiary-container text-tertiary-fixed-dim rounded-full text-sm font-bold">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                <span>Vérifié uniquement</span>
              </button>
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
            listings.map((listing) => {
              const images = JSON.parse(listing.images) as string[];
              const img = images[0] || "";
              return (
                <Link
                  key={listing.id}
                  href={`/listing/${listing.id}`}
                  className="group flex flex-col bg-white rounded-xl overflow-hidden border border-surface-container hover:shadow-md transition-all duration-200"
                >
                  <div className="relative aspect-square overflow-hidden bg-surface-container-low">
                    <img alt={listing.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" src={img} />
                    {listing.isPremium && (
                      <span className="absolute top-2 left-2 bg-secondary-container text-on-secondary-container text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Premium
                      </span>
                    )}
                    {listing.user.verified && !listing.isPremium && (
                      <span className="absolute top-2 left-2 bg-tertiary-container text-tertiary-fixed-dim text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Vérifié
                      </span>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col gap-0.5">
                    <p className="text-on-surface font-semibold text-sm leading-snug line-clamp-2">{listing.title}</p>
                    <p className="text-primary font-bold text-base mt-1">{listing.price.toLocaleString("fr-FR")} €</p>
                    <p className="text-outline text-xs truncate">{listing.location}</p>
                    <p className="text-outline/70 text-[10px]">{formatDistanceToNow(listing.createdAt)}</p>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-20 flex justify-center">
            <div className="flex items-center bg-surface-container-low p-1.5 rounded-full">
              {page > 1 && (
                <Link href={`/search?${new URLSearchParams({ ...(q && { q }), ...(category && { category }), page: String(page - 1) })}`} className="w-10 h-10 flex items-center justify-center rounded-full text-primary hover:bg-white transition-all">
                  <span className="material-symbols-outlined">chevron_left</span>
                </Link>
              )}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/search?${new URLSearchParams({ ...(q && { q }), ...(category && { category }), page: String(p) })}`}
                  className={`w-10 h-10 flex items-center justify-center rounded-full font-medium text-sm hover:bg-white transition-all ${p === page ? "bg-primary text-white font-bold shadow-md" : "text-on-surface-variant"}`}
                >
                  {p}
                </Link>
              ))}
              {page < totalPages && (
                <Link href={`/search?${new URLSearchParams({ ...(q && { q }), ...(category && { category }), page: String(page + 1) })}`} className="w-10 h-10 flex items-center justify-center rounded-full text-primary hover:bg-white transition-all">
                  <span className="material-symbols-outlined">chevron_right</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </main>

      <BottomNav active="recherche" />
    </div>
  );
}

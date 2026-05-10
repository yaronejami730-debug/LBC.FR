import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { formatDistanceToNow } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";
import DejaVuBadge from "@/components/DejaVuBadge";
import EmptyStatePublishCTA from "@/components/EmptyStatePublishCTA";
import StickyPublishFab from "@/components/StickyPublishFab";
import { listingUrl } from "@/lib/listing-slug";

export const revalidate = 3600;

export async function generateStaticParams() {
  return CATEGORIES.map((cat) => ({ categorie: cat.id }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ categorie: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { categorie } = await params;
  const { page: pageParam } = await searchParams;
  const cat = CATEGORIES.find((c) => c.id === categorie);
  if (!cat) return {};

  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const BASE = "https://www.dealandcompany.fr";
  const canonical = page === 1 ? `${BASE}/annonces/${cat.id}` : `${BASE}/annonces/${cat.id}?page=${page}`;
  const title = page === 1
    ? `Annonces ${cat.label} — Achetez et vendez entre particuliers`
    : `Annonces ${cat.label} — Page ${page}`;
  const description = `Parcourez toutes les annonces ${cat.label} sur Deal&Co. Achetez et vendez entre particuliers gratuitement en France. ${cat.subcategories.slice(0, 3).join(", ")} et bien plus.`;

  const total = await prisma.listing
    .count({ where: { status: "APPROVED", deletedAt: null, category: cat.label } as any })
    .catch(() => 0);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Deal&Co",
      type: "website",
      locale: "fr_FR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

const PER_PAGE = 24;

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ categorie: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { categorie } = await params;
  const { page: pageParam } = await searchParams;
  const cat = CATEGORIES.find((c) => c.id === categorie);
  if (!cat) notFound();

  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const skip = (page - 1) * PER_PAGE;

  const [listings, total, priceAgg] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "APPROVED", deletedAt: null, category: cat.label } as any,
      orderBy: [{ isPremium: "desc" }, { createdAt: "desc" }],
      take: PER_PAGE,
      skip,
      include: { user: { select: { verified: true } } },
    }),
    prisma.listing.count({
      where: { status: "APPROVED", deletedAt: null, category: cat.label } as any,
    }),
    prisma.listing.aggregate({
      where: { status: "APPROVED", deletedAt: null, category: cat.label, price: { gt: 0 } } as any,
      _min: { price: true },
      _max: { price: true },
    }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);

  // 404 for empty categories — cleaner signal than noindex (stops crawl budget waste)
  if (total === 0 && page === 1) notFound();

  const BASE = "https://www.dealandcompany.fr";

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
      { "@type": "ListItem", position: 2, name: cat.label, item: `${BASE}/annonces/${cat.id}` },
    ],
  };

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Annonces ${cat.label}`,
    description: `Petites annonces ${cat.label} entre particuliers en France sur Deal&Co`,
    url: `${BASE}/annonces/${cat.id}`,
  };

  const itemListLd = listings.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Annonces ${cat.label}`,
    url: `${BASE}/annonces/${cat.id}`,
    numberOfItems: total,
    ...(priceAgg._min.price && priceAgg._max.price ? {
      offers: {
        "@type": "AggregateOffer",
        offerCount: total,
        lowPrice: priceAgg._min.price,
        highPrice: priceAgg._max.price,
        priceCurrency: "EUR",
      },
    } : {}),
    itemListElement: listings.map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE}${listingUrl(l.id, l.title)}`,
      name: l.title,
    })),
  } : null;

  return (
    <div className="bg-surface text-on-surface mb-24 md:mb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />
      {itemListLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />}
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">{cat.label}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-3xl">{cat.icon}</span>
            <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">
              Annonces {cat.label}
            </h1>
          </div>
          <p className="text-outline text-sm">
            {total.toLocaleString("fr-FR")} annonce{total > 1 ? "s" : ""} disponible{total > 1 ? "s" : ""}
          </p>
          {/* Subcategory chips */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Link
              href={`/search?category=${encodeURIComponent(cat.label)}`}
              className="px-4 py-1.5 rounded-full text-xs font-semibold bg-primary text-white"
            >
              Toutes
            </Link>
            {cat.subcategories.map((sub) => (
              <Link
                key={sub}
                href={`/search?category=${encodeURIComponent(cat.label)}&vehicleType=${encodeURIComponent(sub)}`}
                className="px-4 py-1.5 rounded-full text-xs font-semibold bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:bg-slate-100 transition-colors"
              >
                {sub}
              </Link>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {listings.length === 0 ? (
            <EmptyStatePublishCTA categoryId={cat.id} categoryLabel={cat.label} />
          ) : (
            listings.map((listing) => {
              const images = JSON.parse(listing.images) as string[];
              const img = images[0] || undefined;
              return (
                <Fragment key={listing.id}>
                  <Link
                    href={listingUrl(listing.id, listing.title)}
                    className="group flex flex-col bg-white rounded-xl overflow-hidden border border-surface-container hover:shadow-md transition-all duration-200"
                  >
                    <div className="relative aspect-square overflow-hidden bg-surface-container-low">
                      {img ? (
                        <Image src={img} alt={listing.title} fill sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,20vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-3xl text-outline/30">image</span>
                        </div>
                      )}
                      {listing.isPremium && (
                        <span className="absolute top-2 left-2 bg-secondary-container text-on-secondary-container text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                          Premium
                        </span>
                      )}
                      <DejaVuBadge listingId={listing.id} />
                    </div>
                    <div className="p-2.5 flex flex-col gap-0.5">
                      <p className="text-on-surface font-semibold text-sm leading-snug line-clamp-2">{listing.title}</p>
                      <p className="text-primary font-bold text-base mt-1">{listing.price.toLocaleString("fr-FR")} €</p>
                      <p className="text-outline text-xs truncate">{listing.location}</p>
                      <p className="text-outline/70 text-[10px]">{formatDistanceToNow(listing.createdAt)}</p>
                    </div>
                  </Link>
                </Fragment>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <nav aria-label="Pagination" className="mt-10 flex justify-center items-center gap-3">
            {page > 1 && (
              <Link
                href={page === 2 ? `/annonces/${cat.id}` : `/annonces/${cat.id}?page=${page - 1}`}
                rel="prev"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-surface-container bg-white text-on-surface font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
                Précédent
              </Link>
            )}
            <span className="text-sm text-outline tabular-nums">
              Page {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/annonces/${cat.id}?page=${page + 1}`}
                rel="next"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                Suivant
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </Link>
            )}
          </nav>
        )}
      </main>

      <SiteFooter />
      <BottomNav />
      <StickyPublishFab categoryId={cat.id} />
    </div>
  );
}

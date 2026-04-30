import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { formatDistanceToNow } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";
import DejaVuBadge from "@/components/DejaVuBadge";

export const revalidate = 3600;

export async function generateStaticParams() {
  return CATEGORIES.map((cat) => ({ categorie: cat.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categorie: string }>;
}): Promise<Metadata> {
  const { categorie } = await params;
  const cat = CATEGORIES.find((c) => c.id === categorie);
  if (!cat) return {};

  const BASE = "https://www.dealandcompany.fr";
  const url = `${BASE}/annonces/${cat.id}`;
  const title = `Annonces ${cat.label} — Achetez et vendez entre particuliers | Deal&Co`;
  const description = `Parcourez toutes les annonces ${cat.label} sur Deal&Co. Achetez et vendez entre particuliers gratuitement en France. ${cat.subcategories.slice(0, 3).join(", ")} et bien plus.`;

  const total = await prisma.listing
    .count({ where: { status: "APPROVED", deletedAt: null, category: cat.label } as any })
    .catch(() => 0);

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: total === 0 ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      url,
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

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ categorie: string }>;
}) {
  const { categorie } = await params;
  const cat = CATEGORIES.find((c) => c.id === categorie);
  if (!cat) notFound();

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "APPROVED", deletedAt: null, category: cat.label } as any,
      orderBy: [{ isPremium: "desc" }, { createdAt: "desc" }],
      take: 24,
      include: { user: { select: { verified: true } } },
    }),
    prisma.listing.count({
      where: { status: "APPROVED", deletedAt: null, category: cat.label } as any,
    }),
  ]);

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

  return (
    <div className="bg-surface text-on-surface mb-24 md:mb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />
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
            <div className="col-span-5 py-24 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-5xl block mb-4">search_off</span>
              <p className="text-lg font-semibold">Aucune annonce pour le moment</p>
              <p className="text-sm mt-1">Soyez le premier à publier dans cette catégorie</p>
              <Link href="/post" className="mt-4 inline-block px-6 py-2.5 bg-primary text-white rounded-full text-sm font-semibold">
                Publier une annonce
              </Link>
            </div>
          ) : (
            listings.map((listing) => {
              const images = JSON.parse(listing.images) as string[];
              const img = images[0] || undefined;
              return (
                <Fragment key={listing.id}>
                  <Link
                    href={`/annonce/${listing.id}`}
                    className="group flex flex-col bg-white rounded-xl overflow-hidden border border-surface-container hover:shadow-md transition-all duration-200"
                  >
                    <div className="relative aspect-square overflow-hidden bg-surface-container-low">
                      {img ? (
                        <img alt={listing.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" src={img} />
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

        {/* CTA voir plus */}
        {total > 24 && (
          <div className="mt-10 text-center">
            <Link
              href={`/search?category=${encodeURIComponent(cat.label)}`}
              className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-full font-semibold hover:bg-primary/90 transition-colors"
            >
              Voir les {total.toLocaleString("fr-FR")} annonces
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        )}
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}

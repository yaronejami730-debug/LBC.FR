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
export const dynamicParams = true;

function slugToLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function cityToSlug(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function generateStaticParams() {
  const rows = await prisma.listing.findMany({
    where: { status: "APPROVED", deletedAt: null } as any,
    select: { category: true, location: true },
    distinct: ["category", "location"],
  }).catch(() => []);

  const params: { categorie: string; ville: string }[] = [];

  for (const row of rows) {
    const cat = CATEGORIES.find((c) => c.label === row.category);
    if (!cat || !row.location) continue;
    params.push({
      categorie: cat.id,
      ville: cityToSlug(row.location),
    });
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categorie: string; ville: string }>;
}): Promise<Metadata> {
  const { categorie, ville } = await params;
  const cat = CATEGORIES.find((c) => c.id === categorie);
  if (!cat) return {};

  const cityLabel = slugToLabel(ville);
  const BASE = "https://www.dealandcompany.fr";
  const url = `${BASE}/annonces/${cat.id}/${ville}`;
  const title = `Annonces ${cat.label} à ${cityLabel} — Deal&Co`;
  const description = `Achetez et vendez des annonces ${cat.label} à ${cityLabel} sur Deal&Co. Petites annonces gratuites entre particuliers.`;

  return {
    title,
    description,
    alternates: { canonical: url },
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

export default async function CategoryVillePage({
  params,
}: {
  params: Promise<{ categorie: string; ville: string }>;
}) {
  const { categorie, ville } = await params;
  const cat = CATEGORIES.find((c) => c.id === categorie);
  if (!cat) notFound();

  const cityLabel = slugToLabel(ville);

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where: {
        status: "APPROVED",
        deletedAt: null,
        category: cat.label,
        location: { contains: cityLabel, mode: "insensitive" },
      } as any,
      orderBy: [{ isPremium: "desc" }, { createdAt: "desc" }],
      take: 24,
      include: { user: { select: { verified: true } } },
    }),
    prisma.listing.count({
      where: {
        status: "APPROVED",
        deletedAt: null,
        category: cat.label,
        location: { contains: cityLabel, mode: "insensitive" },
      } as any,
    }),
  ]);

  const BASE = "https://www.dealandcompany.fr";

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
      { "@type": "ListItem", position: 2, name: cat.label, item: `${BASE}/annonces/${cat.id}` },
      { "@type": "ListItem", position: 3, name: cityLabel, item: `${BASE}/annonces/${cat.id}/${ville}` },
    ],
  };

  return (
    <div className="bg-surface text-on-surface mb-24 md:mb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <Link href={`/annonces/${cat.id}`} className="hover:text-primary transition-colors">{cat.label}</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">{cityLabel}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-3xl">{cat.icon}</span>
            <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">
              Annonces {cat.label} à {cityLabel}
            </h1>
          </div>
          <p className="text-outline text-sm">
            {total.toLocaleString("fr-FR")} annonce{total > 1 ? "s" : ""} disponible{total > 1 ? "s" : ""} à {cityLabel}
          </p>

          {/* Autres villes — lien vers la catégorie principale */}
          <div className="flex gap-3 mt-4">
            <Link
              href={`/annonces/${cat.id}`}
              className="px-4 py-1.5 rounded-full text-xs font-semibold bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:bg-slate-100 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Toute la France
            </Link>
            <Link
              href={`/search?category=${encodeURIComponent(cat.label)}&location=${encodeURIComponent(cityLabel)}`}
              className="px-4 py-1.5 rounded-full text-xs font-semibold bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:bg-slate-100 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">tune</span>
              Filtrer
            </Link>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {listings.length === 0 ? (
            <div className="col-span-5 py-24 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-5xl block mb-4">location_off</span>
              <p className="text-lg font-semibold">Aucune annonce à {cityLabel}</p>
              <p className="text-sm mt-1 mb-4">Essayez une ville proche ou cherchez dans toute la France</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link href={`/annonces/${cat.id}`} className="px-6 py-2.5 bg-primary text-white rounded-full text-sm font-semibold">
                  Toute la France
                </Link>
                <Link href="/post" className="px-6 py-2.5 bg-surface-container border border-outline-variant/20 text-on-surface rounded-full text-sm font-semibold">
                  Publier une annonce
                </Link>
              </div>
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

        {total > 24 && (
          <div className="mt-10 text-center">
            <Link
              href={`/search?category=${encodeURIComponent(cat.label)}&location=${encodeURIComponent(cityLabel)}`}
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

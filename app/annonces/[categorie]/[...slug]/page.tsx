import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { FRENCH_CITIES, TOP_CITIES, slugToCity, slugToCityLabel, citySlug } from "@/lib/cities";
import {
  getOrCreateSeoContent,
  fallbackContent,
  subcategoryToSlug,
  slugToSubcategoryLabel,
} from "@/lib/seo-content";
import { formatDistanceToNow } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";
import DejaVuBadge from "@/components/DejaVuBadge";

export const revalidate = 86400;
export const dynamicParams = true;

export function cityToSlug(city: string): string {
  return citySlug(city);
}

const BASE = "https://www.dealandcompany.fr";
const PRIORITY_CATEGORIES = ["vehicules", "immobilier", "multimedia", "mode", "maison"];
const PRIORITY_CITIES = TOP_CITIES.slice(0, 15);

type RouteShape =
  | { kind: "city"; citySlug: string }
  | { kind: "sub-city"; subcategorySlug: string; citySlug: string };

function parseSlug(categorie: string, slug: string[]): RouteShape | null {
  const cat = CATEGORIES.find((c) => c.id === categorie);
  if (!cat) return null;

  if (slug.length === 1) {
    return { kind: "city", citySlug: slug[0] };
  }
  if (slug.length === 2) {
    const subLabel = slugToSubcategoryLabel(categorie, slug[0]);
    if (!subLabel) return null;
    return { kind: "sub-city", subcategorySlug: slug[0], citySlug: slug[1] };
  }
  return null;
}

export async function generateStaticParams() {
  const params: { categorie: string; slug: string[] }[] = [];

  for (const cat of CATEGORIES) {
    for (const city of TOP_CITIES) {
      params.push({ categorie: cat.id, slug: [city.slug] });
    }
  }

  for (const cat of CATEGORIES) {
    if (!PRIORITY_CATEGORIES.includes(cat.id)) continue;
    for (const sub of cat.subcategories) {
      for (const city of PRIORITY_CITIES) {
        params.push({
          categorie: cat.id,
          slug: [subcategoryToSlug(sub), city.slug],
        });
      }
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categorie: string; slug: string[] }>;
}): Promise<Metadata> {
  const { categorie, slug } = await params;
  const cat = CATEGORIES.find((c) => c.id === categorie);
  if (!cat) return {};
  const shape = parseSlug(categorie, slug);
  if (!shape) return {};

  const target =
    shape.kind === "city"
      ? { categoryId: categorie, citySlug: shape.citySlug }
      : { categoryId: categorie, subcategorySlug: shape.subcategorySlug, citySlug: shape.citySlug };

  const content = (await getOrCreateSeoContent(target)) ?? fallbackContent(target);
  const url = `${BASE}/annonces/${cat.id}/${slug.join("/")}`;

  return {
    title: content.metaTitle,
    description: content.metaDescription,
    keywords: content.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: content.metaTitle,
      description: content.metaDescription,
      url,
      siteName: "Deal&Co",
      type: "website",
      locale: "fr_FR",
    },
    twitter: {
      card: "summary_large_image",
      title: content.metaTitle,
      description: content.metaDescription,
    },
  };
}

export default async function AnnoncesGeoPage({
  params,
}: {
  params: Promise<{ categorie: string; slug: string[] }>;
}) {
  const { categorie, slug } = await params;
  const cat = CATEGORIES.find((c) => c.id === categorie);
  if (!cat) notFound();
  const shape = parseSlug(categorie, slug);
  if (!shape) notFound();

  const cityData = slugToCity(shape.citySlug);
  const cityLabel = cityData?.name ?? slugToCityLabel(shape.citySlug);
  const subLabel = shape.kind === "sub-city" ? slugToSubcategoryLabel(categorie, shape.subcategorySlug) : null;

  const target =
    shape.kind === "city"
      ? { categoryId: categorie, citySlug: shape.citySlug }
      : { categoryId: categorie, subcategorySlug: shape.subcategorySlug, citySlug: shape.citySlug };

  const seo = (await getOrCreateSeoContent(target)) ?? fallbackContent(target);

  const whereClause: any = {
    status: "APPROVED",
    deletedAt: null,
    category: cat.label,
    location: { contains: cityLabel, mode: "insensitive" },
  };
  if (shape.kind === "sub-city" && subLabel) {
    whereClause.subcategory = subLabel;
  }

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where: whereClause,
      orderBy: [{ isPremium: "desc" }, { createdAt: "desc" }],
      take: 24,
      include: { user: { select: { verified: true } } },
    }),
    prisma.listing.count({ where: whereClause }),
  ]);

  const neighbouringCities = cityData
    ? FRENCH_CITIES.filter((c) => c.departmentCode === cityData.departmentCode && c.slug !== cityData.slug).slice(0, 8)
    : TOP_CITIES.filter((c) => c.slug !== shape.citySlug).slice(0, 8);

  const otherCategories = CATEGORIES.filter((c) => c.id !== cat.id).slice(0, 8);
  const siblingSubs =
    shape.kind === "sub-city"
      ? cat.subcategories.filter((s) => subcategoryToSlug(s) !== shape.subcategorySlug)
      : cat.subcategories;

  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
    { "@type": "ListItem", position: 2, name: cat.label, item: `${BASE}/annonces/${cat.id}` },
    ...(shape.kind === "sub-city" && subLabel
      ? [
          { "@type": "ListItem", position: 3, name: cityLabel, item: `${BASE}/annonces/${cat.id}/${shape.citySlug}` },
          { "@type": "ListItem", position: 4, name: subLabel, item: `${BASE}/annonces/${cat.id}/${slug.join("/")}` },
        ]
      : [
          { "@type": "ListItem", position: 3, name: cityLabel, item: `${BASE}/annonces/${cat.id}/${shape.citySlug}` },
        ]),
  ];

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: seo.h1,
    itemListElement: listings.map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE}/annonce/${l.id}`,
      name: l.title,
    })),
  };

  const faqLd =
    seo.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: seo.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  const searchUrl =
    shape.kind === "sub-city" && subLabel
      ? `/search?category=${encodeURIComponent(cat.label)}&vehicleType=${encodeURIComponent(subLabel)}&location=${encodeURIComponent(cityLabel)}`
      : `/search?category=${encodeURIComponent(cat.label)}&location=${encodeURIComponent(cityLabel)}`;

  const h2Scope = subLabel ? `${subLabel.toLowerCase()} à ${cityLabel}` : `${cat.label.toLowerCase()} à ${cityLabel}`;

  return (
    <div className="bg-surface text-on-surface mb-24 md:mb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-7xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <Link href={`/annonces/${cat.id}`} className="hover:text-primary transition-colors">{cat.label}</Link>
          <span>/</span>
          {shape.kind === "sub-city" && subLabel ? (
            <>
              <Link href={`/annonces/${cat.id}/${shape.citySlug}`} className="hover:text-primary transition-colors">{cityLabel}</Link>
              <span>/</span>
              <span className="text-on-surface font-semibold">{subLabel}</span>
            </>
          ) : (
            <span className="text-on-surface font-semibold">{cityLabel}</span>
          )}
        </nav>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-3xl">{cat.icon}</span>
            <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">{seo.h1}</h1>
          </div>
          <p className="text-outline text-sm">
            {total.toLocaleString("fr-FR")} annonce{total > 1 ? "s" : ""} {h2Scope}
          </p>
        </div>

        <section className="mb-8 bg-white rounded-2xl p-6 border border-surface-container">
          <p className="text-on-surface leading-relaxed">{seo.intro}</p>
        </section>

        {shape.kind === "city" && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-on-surface mb-3">Affiner par sous-catégorie</h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/annonces/${cat.id}/${shape.citySlug}`}
                className="px-4 py-1.5 rounded-full text-xs font-semibold bg-primary text-white"
              >
                Toutes
              </Link>
              {cat.subcategories.map((sub) => (
                <Link
                  key={sub}
                  href={`/annonces/${cat.id}/${subcategoryToSlug(sub)}/${shape.citySlug}`}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:bg-slate-100 transition-colors"
                >
                  {sub}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {listings.length === 0 ? (
            <div className="col-span-full py-16 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-5xl block mb-4">location_off</span>
              <p className="text-lg font-semibold">Aucune annonce pour le moment {h2Scope}</p>
              <p className="text-sm mt-1 mb-4">Élargissez votre recherche ou soyez le premier à publier</p>
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
              href={searchUrl}
              className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-full font-semibold hover:bg-primary/90 transition-colors"
            >
              Voir les {total.toLocaleString("fr-FR")} annonces
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        )}

        {seo.localTips && (
          <section className="mt-12 bg-white rounded-2xl p-6 border border-surface-container">
            <h2 className="text-xl font-bold text-on-surface mb-3">Conseils pour {h2Scope}</h2>
            <p className="text-on-surface-variant leading-relaxed">{seo.localTips}</p>
          </section>
        )}

        {seo.faq.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-on-surface mb-4">Questions fréquentes</h2>
            <div className="space-y-3">
              {seo.faq.map((item, i) => (
                <details key={i} className="bg-white rounded-xl border border-surface-container p-4 group">
                  <summary className="cursor-pointer font-semibold text-on-surface flex justify-between items-center list-none">
                    {item.q}
                    <span className="material-symbols-outlined text-outline group-open:rotate-180 transition-transform">expand_more</span>
                  </summary>
                  <p className="mt-3 text-on-surface-variant leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12">
          <h2 className="text-lg font-bold text-on-surface mb-3">
            {subLabel ?? cat.label} dans les villes voisines
          </h2>
          <div className="flex flex-wrap gap-2">
            {neighbouringCities.map((c) => {
              const href =
                shape.kind === "sub-city"
                  ? `/annonces/${cat.id}/${shape.subcategorySlug}/${c.slug}`
                  : `/annonces/${cat.id}/${c.slug}`;
              return (
                <Link
                  key={c.slug}
                  href={href}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:bg-slate-100 transition-colors"
                >
                  {c.name}
                </Link>
              );
            })}
          </div>
        </section>

        {shape.kind === "sub-city" ? (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-on-surface mb-3">Autres {cat.label.toLowerCase()} à {cityLabel}</h2>
            <div className="flex flex-wrap gap-2">
              {siblingSubs.map((sub) => (
                <Link
                  key={sub}
                  href={`/annonces/${cat.id}/${subcategoryToSlug(sub)}/${shape.citySlug}`}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:bg-slate-100 transition-colors"
                >
                  {sub}
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-on-surface mb-3">Autres catégories à {cityLabel}</h2>
            <div className="flex flex-wrap gap-2">
              {otherCategories.map((c) => (
                <Link
                  key={c.id}
                  href={`/annonces/${c.id}/${shape.citySlug}`}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:bg-slate-100 transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">{c.icon}</span>
                  {c.label}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}

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
import { getRelatedBlogPostsForCity } from "@/lib/blog/category-links";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";
import EmptyStatePublishCTA from "@/components/EmptyStatePublishCTA";
import StickyPublishFab from "@/components/StickyPublishFab";
import ListingCard from "@/components/home/ListingCard";
import { listingUrl } from "@/lib/listing-slug";

export const revalidate = 86400;
export const dynamicParams = true;

const BASE = "https://www.dealandcompany.fr";
const PRIORITY_CATEGORIES = ["vehicules", "immobilier", "multimedia", "mode", "maison"];
const PRIORITY_CITIES = TOP_CITIES.slice(0, 15);

type RouteShape =
  | { kind: "city"; citySlug: string }
  | { kind: "sub"; subcategorySlug: string }
  | { kind: "sub-city"; subcategorySlug: string; citySlug: string };

function parseSlug(categorie: string, slug: string[]): RouteShape | null {
  const cat = CATEGORIES.find((c) => c.id === categorie);
  if (!cat) return null;

  if (slug.length === 1) {
    // Prefer subcategory match over city — subcategory slugs are domain-specific
    // (voitures, appartements…) and unlikely to collide with city slugs.
    const asSub = slugToSubcategoryLabel(categorie, slug[0]);
    if (asSub) return { kind: "sub", subcategorySlug: slug[0] };
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

  // Sub-only landing pages (cat × sub)
  for (const cat of CATEGORIES) {
    for (const sub of cat.subcategories) {
      params.push({ categorie: cat.id, slug: [subcategoryToSlug(sub)] });
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

const GEO_PER_PAGE = 24;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ categorie: string; slug: string[] }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { categorie, slug } = await params;
  const { page: pageParam } = await searchParams;
  const cat = CATEGORIES.find((c) => c.id === categorie);
  if (!cat) return {};
  const shape = parseSlug(categorie, slug);
  if (!shape) return {};

  const page = Math.max(1, parseInt(pageParam ?? "1", 10));

  const target =
    shape.kind === "city"
      ? { categoryId: categorie, citySlug: shape.citySlug }
      : shape.kind === "sub"
        ? { categoryId: categorie, subcategorySlug: shape.subcategorySlug }
        : { categoryId: categorie, subcategorySlug: shape.subcategorySlug, citySlug: shape.citySlug };

  const cityLabel =
    shape.kind === "sub"
      ? null
      : slugToCity(shape.citySlug)?.name ?? slugToCityLabel(shape.citySlug);
  const subLabel =
    shape.kind === "sub" || shape.kind === "sub-city"
      ? slugToSubcategoryLabel(categorie, shape.subcategorySlug)
      : null;
  const whereClause: any = {
    status: "APPROVED",
    deletedAt: null,
    category: cat.label,
  };
  if (cityLabel) {
    whereClause.location = { contains: cityLabel, mode: "insensitive" };
  }
  if ((shape.kind === "sub" || shape.kind === "sub-city") && subLabel) {
    whereClause.subcategory = subLabel;
  }
  const total = await prisma.listing.count({ where: whereClause }).catch(() => 0);

  const content = (await getOrCreateSeoContent(target)) ?? fallbackContent(target);
  const baseUrl = `${BASE}/annonces/${cat.id}/${slug.join("/")}`;
  const canonical = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;

  const title = page === 1 ? content.metaTitle : `${content.metaTitle} — Page ${page}`;

  return {
    title,
    description: content.metaDescription,
    keywords: content.keywords,
    alternates: { canonical: baseUrl },
    // noindex si page > 1 (pagination) ou page vide (aucune annonce).
    robots: page > 1 || total === 0 ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description: content.metaDescription,
      url: canonical,
      siteName: "Deal&Co",
      type: "website",
      locale: "fr_FR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: content.metaDescription,
    },
  };
}

export default async function AnnoncesGeoPage({
  params,
  searchParams,
}: {
  params: Promise<{ categorie: string; slug: string[] }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { categorie, slug } = await params;
  const { page: pageParam } = await searchParams;
  const cat = CATEGORIES.find((c) => c.id === categorie);
  if (!cat) notFound();
  const shape = parseSlug(categorie, slug);
  if (!shape) notFound();

  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const skip = (page - 1) * GEO_PER_PAGE;

  const cityData = shape.kind === "sub" ? null : slugToCity(shape.citySlug);
  const cityLabel =
    shape.kind === "sub" ? null : (cityData?.name ?? slugToCityLabel(shape.citySlug));
  const subLabel =
    shape.kind === "sub" || shape.kind === "sub-city"
      ? slugToSubcategoryLabel(categorie, shape.subcategorySlug)
      : null;

  const target =
    shape.kind === "city"
      ? { categoryId: categorie, citySlug: shape.citySlug }
      : shape.kind === "sub"
        ? { categoryId: categorie, subcategorySlug: shape.subcategorySlug }
        : { categoryId: categorie, subcategorySlug: shape.subcategorySlug, citySlug: shape.citySlug };

  const seo = (await getOrCreateSeoContent(target)) ?? fallbackContent(target);

  const whereClause: any = {
    status: "APPROVED",
    deletedAt: null,
    category: cat.label,
  };
  if (cityLabel) {
    whereClause.location = { contains: cityLabel, mode: "insensitive" };
  }
  if ((shape.kind === "sub" || shape.kind === "sub-city") && subLabel) {
    whereClause.subcategory = subLabel;
  }

  const baseUrl = `/annonces/${cat.id}/${slug.join("/")}`;

  const total = await prisma.listing.count({ where: whereClause });
  // Page vide : on NE 404 PAS — l'utilisateur voit l'état « aucune annonce »
  // (rendu plus bas). Le `noindex` est posé dans generateMetadata pour ne pas
  // gaspiller le budget de crawl Google sur des pages sans contenu.

  const listings = await prisma.listing.findMany({
    where: whereClause,
    orderBy: [{ isPremium: "desc" }, { createdAt: "desc" }],
    take: GEO_PER_PAGE,
    skip,
    include: { user: { select: { verified: true } } },
  });

  const totalPages = Math.ceil(total / GEO_PER_PAGE);

  const neighbouringCities = cityData
    ? FRENCH_CITIES.filter((c) => c.departmentCode === cityData.departmentCode && c.slug !== cityData.slug).slice(0, 8)
    : shape.kind === "sub"
      ? TOP_CITIES.slice(0, 8)
      : TOP_CITIES.filter((c) => c.slug !== shape.citySlug).slice(0, 8);

  const relatedPosts = getRelatedBlogPostsForCity(cat.id, cityLabel, 4);
  const otherCategories = CATEGORIES.filter((c) => c.id !== cat.id).slice(0, 8);
  const siblingSubs =
    shape.kind === "sub-city" || shape.kind === "sub"
      ? cat.subcategories.filter((s) => subcategoryToSlug(s) !== shape.subcategorySlug)
      : cat.subcategories;

  const breadcrumbItems =
    shape.kind === "sub"
      ? [
          { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
          { "@type": "ListItem", position: 2, name: cat.label, item: `${BASE}/annonces/${cat.id}` },
          { "@type": "ListItem", position: 3, name: subLabel ?? "Sous-catégorie", item: `${BASE}/annonces/${cat.id}/${shape.subcategorySlug}` },
        ]
      : [
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
      url: `${BASE}${listingUrl(l.id, l.title)}`,
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

  const h2Scope =
    shape.kind === "sub"
      ? `${subLabel?.toLowerCase()} en France`
      : subLabel
        ? `${subLabel.toLowerCase()} à ${cityLabel}`
        : `${cat.label.toLowerCase()} à ${cityLabel}`;

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
          ) : shape.kind === "sub" ? (
            <span className="text-on-surface font-semibold">{subLabel}</span>
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

        {shape.kind === "sub" && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-on-surface mb-3">{subLabel} par ville</h2>
            <div className="flex flex-wrap gap-2">
              {TOP_CITIES.slice(0, 15).map((city) => (
                <Link
                  key={city.slug}
                  href={`/annonces/${cat.id}/${shape.subcategorySlug}/${city.slug}`}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:bg-slate-100 transition-colors"
                >
                  {city.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {listings.length === 0 ? (
            <EmptyStatePublishCTA
              categoryId={cat.id}
              categoryLabel={cat.label}
              citySlug={shape.kind === "sub" ? "" : shape.citySlug}
              cityName={cityLabel ?? ""}
              subcategorySlug={
                shape.kind === "sub-city" || shape.kind === "sub"
                  ? shape.subcategorySlug
                  : undefined
              }
              subcategoryLabel={subLabel ?? undefined}
            />
          ) : (
            listings.map((listing, i) => (
              <ListingCard key={listing.id} listing={listing} priority={i === 0} />
            ))
          )}
        </div>

        {totalPages > 1 && (
          <nav aria-label="Pagination" className="mt-10 flex justify-center items-center gap-3">
            {page > 1 && (
              <Link
                href={page === 2 ? baseUrl : `${baseUrl}?page=${page - 1}`}
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
                href={`${baseUrl}?page=${page + 1}`}
                rel="next"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                Suivant
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </Link>
            )}
          </nav>
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

        {shape.kind !== "sub" && (
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
        )}

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
        ) : shape.kind === "sub" ? (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-on-surface mb-3">Autres {cat.label.toLowerCase()}</h2>
            <div className="flex flex-wrap gap-2">
              {siblingSubs.map((sub) => (
                <Link
                  key={sub}
                  href={`/annonces/${cat.id}/${subcategoryToSlug(sub)}`}
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
        {relatedPosts.length > 0 && (
          <section className="mt-12 border-t border-surface-container pt-10">
            <h2 className="text-xl font-bold text-on-surface mb-1">
              Guides pratiques {subLabel ? subLabel.toLowerCase() : cat.label.toLowerCase()}
              {cityLabel ? ` à ${cityLabel}` : ""}
            </h2>
            <p className="text-outline text-sm mb-5">
              Conseils concrets pour acheter et vendre en sécurité.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {relatedPosts.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group block bg-white rounded-xl border border-surface-container p-5 hover:shadow-md transition-all"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                    {p.category}
                  </span>
                  <h3 className="text-base font-bold text-on-surface mt-1 leading-snug group-hover:text-primary transition-colors line-clamp-2">
                    {p.title}
                  </h3>
                  <p className="text-outline text-xs mt-2 leading-relaxed line-clamp-2">
                    {p.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
      <BottomNav />
      <StickyPublishFab categoryId={cat.id} />
    </div>
  );
}

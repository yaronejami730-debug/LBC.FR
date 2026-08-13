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
import { getSeoInventory, isIndexable, listingPageRobots } from "@/lib/seo/inventory";
import { isCityCategoryIndexable } from "@/lib/seo/city-category";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import EmptyStatePublishCTA from "@/components/EmptyStatePublishCTA";
import StickyPublishFab from "@/components/StickyPublishFab";
import ListingCard from "@/components/home/ListingCard";
import { listingUrl } from "@/lib/listing-slug";
import { safeJsonLd } from "@/lib/json-ld";
import { parsePageParam } from "@/lib/pagination";

export const revalidate = 86400;
export const dynamicParams = true;

const BASE = "https://www.dealandcompany.fr";

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

/**
 * On ne pré-rend que les combinaisons qui ont réellement du stock.
 *
 * L'ancienne version générait le produit cartésien catégories × villes ×
 * sous-catégories — environ 800 pages compilées à chaque build, dont la quasi-
 * totalité vides. `dynamicParams` reste à `true` : toute autre combinaison est
 * rendue à la demande, puis mise en cache par le CDN.
 *
 * Les couples ville × catégorie passent par leur juge dédié, plus sévère que
 * le seuil des sous-catégories : voir `lib/seo/city-category.ts`.
 */
export async function generateStaticParams() {
  const inv = await getSeoInventory();
  const params: { categorie: string; slug: string[] }[] = [];

  for (const [key, count] of Object.entries(inv.byCategorySub)) {
    if (!isIndexable(count)) continue;
    const [categorie, ...slug] = key.split("/");
    params.push({ categorie, slug });
  }

  for (const bucket of [inv.byCategoryCity, inv.byCategorySubCity]) {
    for (const key of Object.keys(bucket)) {
      if (!inv.cityCategoryIndexable[key]) continue;
      const [categorie, ...slug] = key.split("/");
      params.push({ categorie, slug });
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

  const page = parsePageParam(pageParam);

  const target =
    shape.kind === "city"
      ? { categoryId: categorie, citySlug: shape.citySlug }
      : shape.kind === "sub"
        ? { categoryId: categorie, subcategorySlug: shape.subcategorySlug }
        : { categoryId: categorie, subcategorySlug: shape.subcategorySlug, citySlug: shape.citySlug };

  // Ville hors référentiel : la page répondra 404 (voir le composant). On ne
  // produit donc aucune metadata — un `<title>` sur une 404 n'a pas de sens et
  // Next sert celle de `not-found.tsx`.
  if (shape.kind !== "sub" && !slugToCity(shape.citySlug)) return {};

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

  /**
   * Verdict d'indexabilité.
   *
   * Deux régimes distincts, et c'est délibéré :
   *
   *   — une page **sous-catégorie** (`/annonces/mode/chaussures`) suit le seuil
   *     historique des pages de liste ;
   *   — une page **ville × catégorie** suit le juge dédié, plus sévère et à
   *     hystérésis. C'est cette famille qui produisait à elle seule les 1 586
   *     URL en `noindex` relevées par Search Console.
   *
   * Le comptage lu ici est celui de l'inventaire — annonces **indexables**
   * seulement — et non le `total` affiché à l'écran, qui inclut les annonces
   * trop pauvres pour l'index. Une page peuplée de trois annonces que Google a
   * déjà écartées n'a rien à lui proposer.
   */
  const inv = await getSeoInventory();
  const cityIndexable =
    shape.kind === "sub"
      ? null
      : isCityCategoryIndexable(
          inv,
          cat.id,
          shape.citySlug,
          shape.kind === "sub-city" ? shape.subcategorySlug : null,
        );

  const content = (await getOrCreateSeoContent(target)) ?? fallbackContent(target);
  const baseUrl = `${BASE}/annonces/${cat.id}/${slug.join("/")}`;
  const canonical = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;

  const title = page === 1 ? content.metaTitle : `${content.metaTitle} — Page ${page}`;

  return {
    title,
    description: content.metaDescription,
    keywords: content.keywords,
    // Auto-référent, page 2 comprise — voir `paginatedCanonical`.
    alternates: { canonical },
    // noindex si page > 1 (pagination), ou si le couple n'atteint pas son seuil.
    // `follow` reste vrai : la page continue de transmettre vers les annonces
    // qu'elle liste, elle cesse simplement de réclamer sa propre indexation.
    robots:
      cityIndexable === null
        ? listingPageRobots(total, page)
        : page > 1 || !cityIndexable
          ? { index: false, follow: true }
          : undefined,
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

  const page = parsePageParam(pageParam);
  const skip = (page - 1) * GEO_PER_PAGE;

  /**
   * Ville inconnue du référentiel → 404 franche.
   *
   * Le segment ville n'était vérifié nulle part : `/annonces/loisirs/nimporte-quoi`
   * répondait 200 avec une page vide. Chaque variante inventée — faute de
   * frappe dans un lien externe, slug forgé par un agrégateur — créait donc une
   * URL explorable de plus, dans un espace lui aussi illimité.
   *
   * Le 404 ne concerne que les villes **inexistantes**. Une ville réelle mais
   * sous le seuil continue de répondre 200 : un visiteur venu d'un favori ou
   * d'un lien externe ne doit pas tomber sur une erreur. Elle est simplement
   * `noindex`, absente du sitemap, et plus aucun lien du site n'y mène.
   */
  const cityData = shape.kind === "sub" ? null : slugToCity(shape.citySlug);
  if (shape.kind !== "sub" && !cityData) notFound();

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

  /**
   * Un lien ville × catégorie n'est émis que si sa cible s'indexe.
   *
   * C'est le levier principal de tout ce chantier. Le `noindex` empêchait
   * l'indexation ; il n'empêchait pas Googlebot de venir. Tant que le maillage
   * interne pointe vers un millier de pages vides, elles sont explorées — et
   * chaque exploration inutile est prise sur le budget des pages qui comptent.
   *
   * Les blocs ci-dessous filtrent donc plutôt que de griser : un chip mort
   * n'apporte rien au visiteur non plus. Un bloc entièrement filtré disparaît.
   */
  const inv = await getSeoInventory();
  const linksTo = (targetCity: string, targetSub?: string | null) =>
    isCityCategoryIndexable(inv, cat.id, targetCity, targetSub);

  const neighbouringCities = (
    cityData
      ? FRENCH_CITIES.filter((c) => c.departmentCode === cityData.departmentCode && c.slug !== cityData.slug)
      : shape.kind === "sub"
        ? TOP_CITIES
        : TOP_CITIES.filter((c) => c.slug !== shape.citySlug)
  )
    .filter((c) =>
      linksTo(c.slug, shape.kind === "sub-city" ? shape.subcategorySlug : null),
    )
    .slice(0, 8);

  const relatedPosts = getRelatedBlogPostsForCity(cat.id, cityLabel, 4);
  const otherCategories = CATEGORIES.filter((c) => c.id !== cat.id)
    .filter((c) =>
      shape.kind === "sub"
        ? true
        : isCityCategoryIndexable(inv, c.id, shape.citySlug),
    )
    .slice(0, 8);
  const siblingSubs =
    shape.kind === "sub-city" || shape.kind === "sub"
      ? cat.subcategories.filter((s) => subcategoryToSlug(s) !== shape.subcategorySlug)
      : cat.subcategories;

  /** Sous-catégories dont la déclinaison sur **cette** ville s'indexe. */
  const linkableSubsHere =
    shape.kind === "sub"
      ? []
      : cat.subcategories.filter((s) => linksTo(shape.citySlug, subcategoryToSlug(s)));

  /** Idem pour les blocs « autres sous-catégories à {ville} » (sub-city). */
  const linkableSiblingSubs =
    shape.kind === "sub-city"
      ? siblingSubs.filter((s) => linksTo(shape.citySlug, subcategoryToSlug(s)))
      : [];

  /** Villes où cette sous-catégorie précise s'indexe (page « sub »). */
  const linkableCitiesForSub =
    shape.kind === "sub"
      ? TOP_CITIES.filter((c) => linksTo(c.slug, shape.subcategorySlug)).slice(0, 15)
      : [];

  /** Le fil d'Ariane d'une page sous-catégorie × ville remonte-t-il à la ville ? */
  const cityCrumbLinkable =
    shape.kind === "sub-city" && linksTo(shape.citySlug);

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
          // La marche « ville » n'existe que si la page ville × catégorie
          // s'indexe. Le JSON-LD est un émetteur de liens comme un autre :
          // Google suit les `item` d'un `BreadcrumbList`.
          ...(shape.kind === "sub-city" && subLabel
            ? [
                ...(cityCrumbLinkable
                  ? [{ "@type": "ListItem", position: 3, name: cityLabel, item: `${BASE}/annonces/${cat.id}/${shape.citySlug}` }]
                  : []),
                { "@type": "ListItem", position: cityCrumbLinkable ? 4 : 3, name: subLabel, item: `${BASE}/annonces/${cat.id}/${slug.join("/")}` },
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
    <div className="bg-surface text-on-surface">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqLd) }} />}
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-7xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <Link href={`/annonces/${cat.id}`} className="hover:text-primary transition-colors">{cat.label}</Link>
          <span>/</span>
          {shape.kind === "sub-city" && subLabel ? (
            <>
              {cityCrumbLinkable && (
                <>
                  <Link href={`/annonces/${cat.id}/${shape.citySlug}`} className="hover:text-primary transition-colors">{cityLabel}</Link>
                  <span>/</span>
                </>
              )}
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

        {shape.kind === "city" && linkableSubsHere.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-on-surface mb-3">Affiner par sous-catégorie</h2>
            <div className="flex flex-wrap gap-2">
              <span className="px-4 py-1.5 rounded-full text-xs font-semibold bg-primary text-white">
                Toutes
              </span>
              {linkableSubsHere.map((sub) => (
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

        {shape.kind === "sub" && linkableCitiesForSub.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-on-surface mb-3">{subLabel} par ville</h2>
            <div className="flex flex-wrap gap-2">
              {linkableCitiesForSub.map((city) => (
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

        {shape.kind !== "sub" && neighbouringCities.length > 0 && (
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
          linkableSiblingSubs.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-on-surface mb-3">Autres {cat.label.toLowerCase()} à {cityLabel}</h2>
            <div className="flex flex-wrap gap-2">
              {linkableSiblingSubs.map((sub) => (
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
          )
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
        ) : otherCategories.length > 0 ? (
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
        ) : null}
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
      <StickyPublishFab categoryId={cat.id} />
    </div>
  );
}

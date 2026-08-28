import { cache } from "react";
import Icon from "@/components/Icon";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { TOP_CITIES } from "@/lib/cities";
import { subcategoryToSlug, fallbackContent } from "@/lib/seo-content";
import { getRelatedBlogPosts } from "@/lib/blog/category-links";
import { listingPageRobots, getSeoInventory, isIndexable, subcategoryHasStock } from "@/lib/seo/inventory";
import { isCityCategoryIndexable } from "@/lib/seo/city-category";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import EmptyStatePublishCTA from "@/components/EmptyStatePublishCTA";
import StickyPublishFab from "@/components/StickyPublishFab";
import ListingCard from "@/components/home/ListingCard";
import { listingUrl } from "@/lib/listing-slug";
import { safeJsonLd } from "@/lib/json-ld";
import { pagedPath, parsePageParam } from "@/lib/pagination";

export const revalidate = 3600;

const getCategoryTotal = cache((label: string) =>
  prisma.listing
    .count({
      where: { status: "APPROVED", deletedAt: null, shadowBanned: false, category: label } as any,
    })
    .catch(() => 0),
);

export async function generateStaticParams() {
  return CATEGORIES.map((cat) => ({ categorie: cat.id }));
}

/**
 * Le numéro de page arrive par le chemin (`/annonces/mode/page/2`), jamais par
 * `?page=`. Lire `searchParams` ici rendrait la route dynamique et annulerait
 * le `revalidate` déclaré plus haut — voir `pagedPath`, `lib/pagination.ts`.
 * Le segment est optionnel : son absence, c'est la page 1.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ categorie: string; numero?: string }>;
}): Promise<Metadata> {
  const { categorie, numero } = await params;
  const cat = CATEGORIES.find((c) => c.id === categorie);
  if (!cat) return {};

  const page = parsePageParam(numero);
  const BASE = "https://www.dealandcompany.fr";
  const canonical = pagedPath(`${BASE}/annonces/${cat.id}`, page);

  const total = await getCategoryTotal(cat.label);

  const countLabel = total > 0 ? `${total.toLocaleString("fr-FR")} annonces` : "Annonces";
  const title = page === 1
    ? `${cat.label} — ${countLabel} gratuites entre particuliers`
    : `Annonces ${cat.label} — Page ${page}`;
  const description = `${countLabel} ${cat.label.toLowerCase()} sur Deal&Co. Achetez et vendez entre particuliers gratuitement en France. ${cat.subcategories.slice(0, 3).join(", ")} et bien plus.`;

  const ogImage = `${BASE}/annonces/${cat.id}/opengraph-image`;
  return {
    title,
    description,
    // Auto-référent, page 2 comprise. Marquer une page `noindex` tout en la
    // rattachant à une autre URL envoie deux ordres contradictoires ; Google
    // demande explicitement de ne pas combiner les deux.
    alternates: { canonical },
    robots: listingPageRobots(total, page),
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Deal&Co",
      type: "website",
      locale: "fr_FR",
      images: [{ url: ogImage, width: 1200, height: 630, alt: `Annonces ${cat.label}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

const PER_PAGE = 24;

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ categorie: string; numero?: string }>;
}) {
  const { categorie, numero } = await params;
  const cat = CATEGORIES.find((c) => c.id === categorie);
  if (!cat) notFound();

  const page = parsePageParam(numero);
  const skip = (page - 1) * PER_PAGE;

  const [listings, total, priceAgg] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "APPROVED", deletedAt: null, shadowBanned: false, category: cat.label } as any,
      orderBy: [{ isPremium: "desc" }, { createdAt: "desc" }],
      take: PER_PAGE,
      skip,
      include: { user: { select: { verified: true } } },
    }),
    getCategoryTotal(cat.label),
    prisma.listing.aggregate({
      where: {
        status: "APPROVED",
        deletedAt: null,
        shadowBanned: false,
        category: cat.label,
        price: { gt: 0 },
      } as any,
      _min: { price: true },
      _max: { price: true },
    }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);

  // Une catégorie vide n'est plus une 404 : la navigation et le pied de page
  // pointent vers les 13 catégories, et renvoyer une erreur depuis chaque page
  // du site est un signal bien pire qu'une page pauvre. On sert donc l'état
  // vide avec un appel à publier — `generateMetadata` pose le `noindex`, donc
  // rien n'entre dans l'index et le budget d'exploration reste protégé.

  const seo = fallbackContent({ categoryId: cat.id });
  const relatedPosts = getRelatedBlogPosts(cat.id, 4);

  const inv = await getSeoInventory().catch(() => null);

  /**
   * Bloc « {catégorie} par ville ».
   *
   * C'était le principal émetteur de liens vers la matrice ville × catégorie :
   * quinze liens par page de catégorie, treize catégories, quasiment tous vers
   * des pages vides que Googlebot explorait ensuite une par une. On ne garde
   * que les couples qui s'indexent réellement — souvent aucun, au stock actuel,
   * et le bloc disparaît alors plutôt que d'afficher des liens morts.
   */
  const topCities = inv
    ? TOP_CITIES.filter((city) => isCityCategoryIndexable(inv, cat.id, city.slug)).slice(0, 15)
    : [];

  /**
   * Sous-catégories réellement visitables.
   *
   * La page d'une sous-catégorie sans stock renvoie 404 — voir
   * `app/annonces/[categorie]/[...slug]/page.tsx`. Les puces affichaient
   * pourtant la taxonomie entière : sur « Maison », sept puces pour quatre
   * pages existantes, donc trois liens morts remontés par le crawl du
   * 23/08/2026.
   *
   * Sans inventaire — base injoignable — on n'affiche aucune puce plutôt que
   * de risquer un lien mort : la page catégorie reste entièrement utilisable,
   * elle liste déjà les annonces.
   */
  const linkableSubs = inv
    ? cat.subcategories
        .map((label) => ({ label, slug: subcategoryToSlug(label) }))
        .filter(({ slug }) => subcategoryHasStock(inv, cat.id, slug))
    : [];

  /**
   * Marques de véhicules ayant assez de stock pour mériter leur page.
   *
   * Ces pages existaient, étaient au sitemap, et **aucun lien du site n'y
   * menait** : 24 pages orphelines relevées par l'audit. Un crawler qui ne
   * trouve une URL que dans le sitemap la traite comme un cul-de-sac. On les
   * raccroche donc ici, à la seule page dont elles dépendent, et seulement
   * celles qui passent le seuil d'indexation — pas de lien vers une page vide.
   */
  const brandLinks =
    cat.id === "vehicules" && inv
      ? Object.entries(inv.byBrand)
          .filter(([, count]) => isIndexable(count))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 24)
      : ([] as [string, number][]);

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
    <div className="bg-surface text-on-surface">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(collectionLd) }} />
      {itemListLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListLd) }} />}
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqLd) }} />}
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
              Annonces {cat.label} d&apos;occasion entre particuliers en France
            </h1>
          </div>
          <p className="text-outline text-sm">
            {total.toLocaleString("fr-FR")} annonce{total > 1 ? "s" : ""} disponible{total > 1 ? "s" : ""}
          </p>
          {/* Sous-catégories — seulement celles qui ont du stock.
              La page d'une sous-catégorie vide renvoie 404 : afficher la
              taxonomie entière produisait trois liens morts sur « Maison »
              (bricolage, électroménager, jardinage) au crawl du 23/08/2026. */}
          {linkableSubs.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              <Link
                href={`/annonces/${cat.id}`}
                className="px-4 py-1.5 rounded-full text-xs font-semibold bg-primary text-white"
              >
                Toutes
              </Link>
              {linkableSubs.map(({ label, slug }) => (
                <Link
                  key={label}
                  href={`/annonces/${cat.id}/${slug}`}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:bg-slate-100 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {listings.length === 0 ? (
            <EmptyStatePublishCTA categoryId={cat.id} categoryLabel={cat.label} />
          ) : (
            listings.map((listing, i) => (
              <ListingCard key={listing.id} listing={listing} priority={i === 0} />
            ))
          )}
        </div>

        {/* SEO intro */}
        {page === 1 && (
          <section className="mt-10 bg-white rounded-2xl p-6 border border-surface-container">
            <p className="text-on-surface leading-relaxed">{seo.intro}</p>
          </section>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav aria-label="Pagination" className="mt-10 flex justify-center items-center gap-3">
            {page > 1 && (
              <Link
                href={pagedPath(`/annonces/${cat.id}`, page - 1)}
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
                href={pagedPath(`/annonces/${cat.id}`, page + 1)}
                rel="next"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                Suivant
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </Link>
            )}
          </nav>
        )}
        {/* Top cities */}
        {page === 1 && topCities.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-bold text-on-surface mb-3">
              {cat.label} par ville
            </h2>
            <div className="flex flex-wrap gap-2">
              {topCities.map((city) => (
                <Link
                  key={city.slug}
                  href={`/annonces/${cat.id}/${city.slug}`}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:bg-slate-100 transition-colors"
                >
                  {cat.label} à {city.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Marques — uniquement sous Véhicules, et uniquement celles qui
            tiennent debout toutes seules. */}
        {page === 1 && brandLinks.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-bold text-on-surface mb-3">Voitures d&apos;occasion par marque</h2>
            <div className="flex flex-wrap gap-2">
              {brandLinks.map(([slug, count]) => (
                <Link
                  key={slug}
                  href={`/annonces/vehicules/${slug}`}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold bg-surface-container border border-outline-variant/10 text-on-surface-variant hover:bg-slate-100 transition-colors"
                >
                  <span className="capitalize">{slug.replace(/-/g, " ")}</span>
                  <span className="text-outline ml-1.5 tabular-nums">{count}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        {page === 1 && seo.faq.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-on-surface mb-4">Questions fréquentes</h2>
            <div className="space-y-3">
              {seo.faq.map((item, i) => (
                <details key={i} className="bg-white rounded-xl border border-surface-container p-4 group">
                  <summary className="cursor-pointer font-semibold text-on-surface flex justify-between items-center list-none">
                    {item.q}
                    <Icon name="expand_more" className="material-symbols-outlined text-outline group-open:rotate-180 transition-transform" />
                  </summary>
                  <p className="mt-3 text-on-surface-variant leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Related blog */}
        {page === 1 && relatedPosts.length > 0 && (
          <section className="mt-12 border-t border-surface-container pt-10">
            <h2 className="text-xl font-bold text-on-surface mb-1">
              Guides pratiques {cat.label.toLowerCase()}
            </h2>
            <p className="text-outline text-sm mb-5">
              Conseils pour acheter et vendre {cat.label.toLowerCase()} en sécurité.
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

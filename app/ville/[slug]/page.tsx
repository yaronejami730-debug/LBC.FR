import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { FRENCH_CITIES, slugToCity, citySlug as toCitySlug } from "@/lib/cities";
import { listingUrl } from "@/lib/listing-slug";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";
import ListingCard from "@/components/home/ListingCard";

export const revalidate = 86400;
export const dynamicParams = true;

const BASE = "https://www.dealandcompany.fr";

export async function generateStaticParams() {
  return FRENCH_CITIES.slice(0, 40).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const city = slugToCity(slug);
  if (!city) return {};

  const total = await prisma.listing
    .count({
      where: {
        status: "APPROVED",
        deletedAt: null,
        location: { contains: city.name, mode: "insensitive" },
      } as any,
    })
    .catch(() => 0);

  if (total === 0) return { robots: { index: false, follow: true } };

  const countLabel = `${total.toLocaleString("fr-FR")} annonce${total > 1 ? "s" : ""}`;
  const title = `Annonces à ${city.name} (${city.departmentCode}) — ${countLabel} gratuites`;
  const description = `${countLabel} entre particuliers à ${city.name}, ${city.department}. Voitures, immobilier, mode, électroménager — vendez et achetez près de chez vous gratuitement sur Deal&Co.`;
  const canonical = `${BASE}/ville/${city.slug}`;

  const ogImage = `${BASE}/ville/${city.slug}/opengraph-image`;
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
      images: [{ url: ogImage, width: 1200, height: 630, alt: `Annonces à ${city.name}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

const PREVIEW_PER_CAT = 6;

export default async function VillePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const city = slugToCity(slug);
  if (!city) notFound();

  const where = {
    status: "APPROVED",
    deletedAt: null,
    shadowBanned: false,
    location: { contains: city.name, mode: "insensitive" },
  } as any;

  const [total, grouped, recent] = await Promise.all([
    prisma.listing.count({ where }).catch(() => 0),
    prisma.listing
      .groupBy({
        by: ["category"],
        where,
        _count: { _all: true },
      })
      .catch(() => [] as { category: string; _count: { _all: number } }[]),
    prisma.listing
      .findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 60,
        select: {
          id: true,
          title: true,
          price: true,
          images: true,
          createdAt: true,
          category: true,
          location: true,
          isPremium: true,
        },
      })
      .catch(() => []),
  ]);

  if (total === 0) notFound();

  const countsByCat = new Map<string, number>();
  for (const row of grouped) {
    countsByCat.set(row.category, row._count._all);
  }

  const catsWithListings = CATEGORIES.filter(
    (c) => (countsByCat.get(c.label) ?? 0) > 0,
  );

  const byCategory = new Map<string, typeof recent>();
  for (const cat of catsWithListings) {
    byCategory.set(
      cat.id,
      recent.filter((l) => l.category === cat.label).slice(0, PREVIEW_PER_CAT),
    );
  }

  const nearbyCities = FRENCH_CITIES.filter(
    (c) => c.region === city.region && c.slug !== city.slug,
  ).slice(0, 12);

  const pageUrl = `${BASE}/ville/${city.slug}`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
      { "@type": "ListItem", position: 2, name: `Annonces à ${city.name}`, item: pageUrl },
    ],
  };

  const placeLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: city.name,
    address: {
      "@type": "PostalAddress",
      addressLocality: city.name,
      addressRegion: city.region,
      addressCountry: "FR",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: city.lat,
      longitude: city.lng,
    },
  };

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: recent.slice(0, 20).map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE}${listingUrl(l.id, l.title)}`,
      name: l.title,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />

      <Navbar />

      <main className="max-w-6xl mx-auto px-4 pt-6 pb-20">
        {/* Breadcrumbs */}
        <nav className="text-xs text-outline mb-4 flex flex-wrap items-center gap-1.5">
          <Link href="/" className="hover:text-primary">Accueil</Link>
          <span>›</span>
          <span className="text-on-surface font-medium">
            Annonces à {city.name}
          </span>
        </nav>

        {/* Hero */}
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-on-surface font-['Manrope'] leading-tight">
            Petites annonces à {city.name} entre particuliers{" "}
            <span className="text-outline font-bold text-xl">({city.departmentCode})</span>
          </h1>
          <p className="mt-2 text-sm sm:text-base text-on-surface-variant max-w-3xl">
            <strong>{total.toLocaleString("fr-FR")} annonce{total > 1 ? "s" : ""}</strong>{" "}
            entre particuliers à {city.name}, {city.department}, en{" "}
            {city.region}. Voitures, immobilier, mode, électroménager — achetez
            et vendez près de chez vous, gratuitement, sur Deal&amp;Co.
          </p>
        </header>

        {/* Catégories grid links */}
        <section className="mb-10">
          <h2 className="text-lg font-extrabold text-on-surface font-['Manrope'] mb-4">
            Toutes les catégories à {city.name}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {catsWithListings.map((cat) => {
              const n = countsByCat.get(cat.label) ?? 0;
              return (
                <Link
                  key={cat.id}
                  href={`/annonces/${cat.id}/${city.slug}`}
                  className="flex items-center justify-between rounded-2xl bg-white border border-slate-200 hover:border-primary hover:bg-primary/[0.03] px-4 py-3 transition-all"
                >
                  <span className="text-sm font-bold text-on-surface">
                    {cat.label}
                  </span>
                  <span className="text-[11px] font-bold text-outline">{n}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Listings par catégorie */}
        {catsWithListings.map((cat) => {
          const items = byCategory.get(cat.id) ?? [];
          if (items.length === 0) return null;
          const totalInCat = countsByCat.get(cat.label) ?? 0;
          return (
            <section key={cat.id} className="mb-10">
              <div className="flex items-end justify-between mb-3">
                <h2 className="text-lg font-extrabold text-on-surface font-['Manrope']">
                  {cat.label} à {city.name}
                </h2>
                <Link
                  href={`/annonces/${cat.id}/${city.slug}`}
                  className="text-xs text-primary font-bold hover:underline whitespace-nowrap"
                >
                  Voir les {totalInCat.toLocaleString("fr-FR")} →
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {items.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={{ ...l, location: l.location ?? city.name }}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {/* Villes voisines (maillage interne) */}
        {nearbyCities.length > 0 && (
          <section className="mt-12 pt-8 border-t border-slate-200">
            <h2 className="text-lg font-extrabold text-on-surface font-['Manrope'] mb-4">
              Annonces dans d&apos;autres villes de {city.region}
            </h2>
            <div className="flex flex-wrap gap-2">
              {nearbyCities.map((n) => (
                <Link
                  key={n.slug}
                  href={`/ville/${n.slug}`}
                  className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-primary/10 text-xs font-bold text-on-surface hover:text-primary transition-all"
                >
                  {n.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* FAQ SEO */}
        <section className="mt-12 pt-8 border-t border-slate-200">
          <h2 className="text-lg font-extrabold text-on-surface font-['Manrope'] mb-4">
            Questions fréquentes — annonces à {city.name}
          </h2>
          <div className="space-y-4">
            <details className="rounded-2xl bg-slate-50 p-4">
              <summary className="font-bold text-sm text-on-surface cursor-pointer">
                Comment publier une annonce gratuite à {city.name} ?
              </summary>
              <p className="mt-2 text-sm text-on-surface-variant">
                Créez un compte gratuit, ajoutez vos photos, indiquez{" "}
                {city.name} comme localisation et publiez votre annonce en
                quelques minutes. Aucune commission n&apos;est prélevée sur les
                ventes entre particuliers.
              </p>
            </details>
            <details className="rounded-2xl bg-slate-50 p-4">
              <summary className="font-bold text-sm text-on-surface cursor-pointer">
                Combien d&apos;annonces sont disponibles à {city.name} ?
              </summary>
              <p className="mt-2 text-sm text-on-surface-variant">
                Il y a actuellement {total.toLocaleString("fr-FR")} annonces
                actives à {city.name} et ses environs, réparties dans{" "}
                {catsWithListings.length} catégories.
              </p>
            </details>
            <details className="rounded-2xl bg-slate-50 p-4">
              <summary className="font-bold text-sm text-on-surface cursor-pointer">
                Les transactions sont-elles sécurisées ?
              </summary>
              <p className="mt-2 text-sm text-on-surface-variant">
                Deal&amp;Co met en relation acheteurs et vendeurs. Nous
                recommandons d&apos;effectuer les transactions en main propre
                à {city.name} et de vérifier l&apos;objet avant paiement.
              </p>
            </details>
          </div>
        </section>
      </main>

      <BottomNav />
      <SiteFooter />
    </>
  );
}

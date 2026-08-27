import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { FRENCH_CITIES, slugToCity, citySlug as toCitySlug, type FrenchCity } from "@/lib/cities";
import { postcodesForCity, resolveCity } from "@/lib/seo/city";
import { listingUrl } from "@/lib/listing-slug";
import { getSeoInventory, isIndexable } from "@/lib/seo/inventory";
import { isCityCategoryIndexable } from "@/lib/seo/city-category";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import ListingCard from "@/components/home/ListingCard";
import { safeJsonLd } from "@/lib/json-ld";

export const revalidate = 86400;
export const dynamicParams = true;

const BASE = "https://www.dealandcompany.fr";

/** Seules les villes qui ont réellement du stock sont pré-rendues ; les autres
 *  restent accessibles à la demande (`dynamicParams`) mais en `noindex`. */
export async function generateStaticParams() {
  const inv = await getSeoInventory();
  return Object.entries(inv.byCity)
    .filter(([, count]) => isIndexable(count))
    .map(([slug]) => ({ slug }));
}

/**
 * Requête large qui ne peut rien rater : nom de la commune **ou** l'un de ses
 * codes postaux réels. Elle sur-sélectionne volontairement — `resolveCity`
 * tranche ensuite. Voir le commentaire du composant de page.
 */
function cityPrefilter(city: FrenchCity) {
  return {
    status: "APPROVED",
    deletedAt: null,
    shadowBanned: false,
    OR: [
      { location: { contains: city.name, mode: "insensitive" } },
      ...postcodesForCity(city.slug).map((postcode) => ({
        location: { contains: postcode },
      })),
    ],
  } as any;
}

/** Le stock réel d'une ville, au sens du juge unique. */
async function countListingsIn(city: FrenchCity): Promise<number> {
  const rows = await prisma.listing
    .findMany({ where: cityPrefilter(city), select: { location: true } })
    .catch(() => [] as { location: string | null }[]);
  return rows.filter((row) => resolveCity(row.location)?.slug === city.slug).length;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const city = slugToCity(slug);
  if (!city) return {};

  const total = await countListingsIn(city);

  const countLabel = `${total.toLocaleString("fr-FR")} annonce${total > 1 ? "s" : ""}`;
  const title = `Annonces à ${city.name} (${city.departmentCode}) — ${countLabel} gratuites`;
  const description = `${countLabel} entre particuliers à ${city.name}, ${city.department}. Voitures, immobilier, mode, électroménager — vendez et achetez près de chez vous gratuitement sur Deal&Co.`;
  // Page non paginée : le canonical est trivialement auto-référent.
  const canonical = `${BASE}/ville/${city.slug}`;

  const ogImage = `${BASE}/ville/${city.slug}/opengraph-image`;
  return {
    title,
    description,
    alternates: { canonical },
    // Une page ville avec une ou deux annonces ne sert personne : Google la
    // classe en contenu mince et le signal rejaillit sur tout le domaine. On
    // la sert quand même (liens suivis), sans la faire entrer dans l'index.
    robots: isIndexable(total) ? undefined : { index: false, follow: true },
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

  /**
   * Rattachement ville → annonces : `resolveCity`, comme partout ailleurs.
   *
   * Cette page appliquait sa propre règle — `location contains city.name` —
   * alors que le sitemap, l'inventaire et le fil d'Ariane passent par
   * `lib/seo/city.ts`. Deux juges pour la même question, et l'écart mesuré le
   * 27/08/2026 se lisait directement dans le sweep HTTP :
   *
   *   - « 45000 » et « 75001 » ne contiennent pas le nom de la commune, donc
   *     Orléans répondait 404 avec une annonce réelle et Paris en oubliait une ;
   *   - « fort de france » sans traits d'union échappait aussi à la comparaison,
   *     404 avec deux annonces.
   *
   * SQL ne peut pas exécuter `resolveCity`. On procède donc en deux temps :
   * une requête large qui ne peut rien rater (nom de la commune **ou** l'un de
   * ses codes postaux réels), puis le juge en mémoire qui tranche. La colonne
   * `location` est étroite, la requête reste bon marché même quand le stock
   * grandit.
   */
  const prefilter = cityPrefilter(city);

  const belongsHere = (location: string | null) => resolveCity(location)?.slug === city.slug;

  const [scope, candidates] = await Promise.all([
    // Compte exact et répartition par catégorie. Deux colonnes seulement.
    prisma.listing
      .findMany({ where: prefilter, select: { category: true, location: true } })
      .catch(() => [] as { category: string; location: string | null }[]),
    // Cartes affichées. On élargit la prise avant filtrage pour que le juge ait
    // de quoi remplir les 60 emplacements même s'il écarte des candidats.
    prisma.listing
      .findMany({
        where: prefilter,
        orderBy: { createdAt: "desc" },
        take: 240,
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

  const inScope = scope.filter((row) => belongsHere(row.location));
  const total = inScope.length;
  const recent = candidates.filter((row) => belongsHere(row.location)).slice(0, 60);

  if (total === 0) notFound();

  const countsByCat = new Map<string, number>();
  for (const row of inScope) {
    countsByCat.set(row.category, (countsByCat.get(row.category) ?? 0) + 1);
  }

  const catsWithListings = CATEGORIES.filter(
    (c) => (countsByCat.get(c.label) ?? 0) > 0,
  );

  /**
   * Quelles catégories méritent un lien `/annonces/{cat}/{ville}` ?
   *
   * Avoir une annonce dans la catégorie ne suffit pas — c'était le critère
   * précédent, et il produisait jusqu'à treize liens par page ville vers des
   * pages à une ou deux annonces. Le juge dédié (`lib/seo/city-category.ts`)
   * tranche désormais, et la page ville continue d'afficher ses annonces par
   * catégorie : c'est le lien vers la page ville × catégorie qui disparaît,
   * pas le contenu.
   */
  const inv = await getSeoInventory().catch(() => null);
  const linkableCats = new Set(
    inv
      ? catsWithListings
          .filter((c) => isCityCategoryIndexable(inv, c.id, city.slug))
          .map((c) => c.id)
      : [],
  );

  const byCategory = new Map<string, typeof recent>();
  for (const cat of catsWithListings) {
    byCategory.set(
      cat.id,
      recent.filter((l) => l.category === cat.label).slice(0, PREVIEW_PER_CAT),
    );
  }

  /**
   * Villes voisines — filtrées sur le stock, pas sur la géographie.
   *
   * Ce bloc listait douze villes de la région tirées du référentiel statique,
   * sans regarder si elles avaient une annonce. Or la ligne `if (total === 0)
   * notFound()` ci-dessus fait répondre 404 à toute ville sans stock : sur les
   * 168 liens que l'ensemble des pages ville émettaient, **152 pointaient vers
   * un 404** (relevé du 27/08/2026, 154 villes au référentiel, 20 avec du
   * stock).
   *
   * Le coût n'est pas cosmétique. Googlebot suit ces liens avant de découvrir
   * qu'ils ne mènent nulle part, et chaque exploration inutile est prise sur le
   * budget des pages qui comptent — c'est la règle que
   * `/annonces/[categorie]/[...slug]` applique déjà à ses propres blocs.
   *
   * `inv.byCity` ne compte que les annonces indexables : une ville qui n'a que
   * du stock trop pauvre pour l'index perd donc son lien. C'est voulu — cette
   * page-là existe, mais elle est `noindex`, et lui envoyer du budget
   * d'exploration ne rapporte rien.
   */
  const stockByCity = (inv?.byCity ?? {}) as Record<string, number>;
  const nearbyCities = FRENCH_CITIES.filter(
    (c) => c.region === city.region && c.slug !== city.slug && (stockByCity[c.slug] ?? 0) > 0,
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
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(placeLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListLd) }}
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
              const content = (
                <>
                  <span className="text-sm font-bold text-on-surface">
                    {cat.label}
                  </span>
                  <span className="text-[11px] font-bold text-outline">{n}</span>
                </>
              );
              const shell =
                "flex items-center justify-between rounded-2xl bg-white border border-slate-200 px-4 py-3 transition-all";

              // Catégorie sous le seuil sur cette ville : la tuile reste
              // affichée — le visiteur voit ce qui existe près de chez lui — mais
              // elle cesse d'émettre un lien vers une page que Google ne doit
              // plus explorer. La catégorie nationale reste accessible depuis la
              // navigation.
              return linkableCats.has(cat.id) ? (
                <Link
                  key={cat.id}
                  href={`/annonces/${cat.id}/${city.slug}`}
                  className={`${shell} hover:border-primary hover:bg-primary/[0.03]`}
                >
                  {content}
                </Link>
              ) : (
                <div key={cat.id} className={shell}>
                  {content}
                </div>
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
                {linkableCats.has(cat.id) && (
                  <Link
                    href={`/annonces/${cat.id}/${city.slug}`}
                    className="text-xs text-primary font-bold hover:underline whitespace-nowrap"
                  >
                    Voir les {totalInCat.toLocaleString("fr-FR")} →
                  </Link>
                )}
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
      <SiteFooter />
    </>
  );
}

/**
 * Deal&Co Auto — la une automobile.
 *
 * ── Pourquoi elle est séparée de Deal&Co Info ─────────────────────────────
 *
 * Un essai de Clio et un article sur la rentrée scolaire n'ont ni le même
 * lecteur ni la même utilité. Le premier se lit à côté d'une cote et
 * d'annonces — c'est là que Deal&Co apporte quelque chose que le média n'a
 * pas. Le second se lit pour lui-même. Mélangés dans une seule grille, les
 * deux donnaient une page qui ne s'adressait à personne.
 *
 * Cette une est donc bâtie autour de ce que nous savons du marché : les
 * marques que nous suivons, les cotes que nous calculons, les annonces que
 * nous avons en ligne.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import ArticleCard from "@/components/news/ArticleCard";
import { getNewsFeed, coveredBrands } from "@/lib/news/articles";
import { frDateTime } from "@/lib/news/format";
import { AUTO_SECTION } from "@/lib/news/sources";
import { safeJsonLd } from "@/lib/json-ld";

const BASE = "https://www.dealandcompany.fr";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Deal&Co Auto — essais, nouveautés et cotes d'occasion",
  description:
    "Deal&Co Auto : l'actualité automobile — essais, nouveautés et vidéos de la presse spécialisée — avec, pour chaque modèle, sa cote d'occasion et les annonces entre particuliers.",
  alternates: { canonical: `${BASE}/actualites/auto` },
  openGraph: {
    title: "Deal&Co Auto",
    description:
      "Essais, nouveautés et vidéos de la presse automobile, avec les cotes et les annonces d'occasion.",
    url: `${BASE}/actualites/auto`,
    siteName: "Deal&Co",
    locale: "fr_FR",
    type: "website",
  },
};

export default async function AutoPage() {
  const [articles, videos, brands] = await Promise.all([
    getNewsFeed(null, 16, 0, AUTO_SECTION),
    getNewsFeed(null, 3, 0, AUTO_SECTION).then((list) => list.filter((a) => a.kind === "video")),
    coveredBrands(2),
  ]);

  const [lead, ...rest] = articles;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Deal&Co Auto",
    url: `${BASE}/actualites/auto`,
    description:
      "Actualité automobile : essais, nouveautés et vidéos, avec les cotes et annonces d'occasion.",
    ...(lead ? { dateModified: lead.publishedAt.toISOString() } : {}),
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 pt-32 pb-16">
        <nav className="mb-4 text-xs text-outline">
          <Link href="/actualites" className="hover:text-primary">
            Deal&amp;Co Info
          </Link>
          <span className="mx-1.5">›</span>
          <span>Auto</span>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
            Deal&amp;Co Auto
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            Essais, nouveautés et vidéos de la presse spécialisée — et, pour chaque
            modèle dont on parle, ce qu&apos;il vaut d&apos;occasion et les annonces
            entre particuliers que nous avons en ligne.
          </p>
          {lead && (
            <p className="mt-2 text-xs text-outline">
              Dernière mise à jour{" "}
              <time dateTime={lead.publishedAt.toISOString()}>{frDateTime(lead.publishedAt)}</time>
            </p>
          )}
        </header>

        {articles.length === 0 ? (
          <p className="rounded-2xl border border-surface-container bg-white p-6 text-sm text-on-surface-variant">
            Aucune actualité automobile pour l&apos;instant.
          </p>
        ) : (
          <>
            {brands.length > 0 && (
              <nav
                aria-label="Marques suivies"
                className="mb-8 flex flex-wrap gap-2 border-b border-surface-container pb-4"
              >
                {brands.slice(0, 16).map((b) => (
                  <Link
                    key={b.brandSlug}
                    href={`/actualites/marque/${b.brandSlug}`}
                    className="rounded-full bg-surface-container px-4 py-2 text-xs font-bold capitalize text-on-surface transition-colors hover:bg-primary hover:text-white"
                  >
                    {b.brandSlug.replace(/-/g, " ")}
                  </Link>
                ))}
              </nav>
            )}

            {lead && (
              <div className="mb-8 md:grid md:grid-cols-2 md:gap-6">
                <ArticleCard article={lead} priority />
                <div className="mt-4 grid gap-4 sm:grid-cols-2 md:mt-0">
                  {rest.slice(0, 2).map((a) => (
                    <ArticleCard key={a.slug} article={a} />
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.slice(2).map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>

            {videos.length > 0 && (
              <section className="mt-12">
                <h2 className="mb-4 border-b border-surface-container pb-2 text-xl font-extrabold tracking-tight text-on-surface">
                  En vidéo
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {videos.map((v) => (
                    <ArticleCard key={v.slug} article={v} />
                  ))}
                </div>
              </section>
            )}

            {/* Ce que cette une a et qu'aucun média n'a : le marché lui-même. */}
            <section className="mt-12 rounded-2xl border border-surface-container bg-white p-6">
              <h2 className="text-lg font-bold text-on-surface">
                Acheter ou vendre, pas seulement lire
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
                La presse dit ce que vaut une voiture neuve. Nous disons ce qu&apos;elle
                vaut d&apos;occasion, calculé sur les annonces réelles entre particuliers,
                ventes passées comprises.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/annonces/vehicules"
                  className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20 transition-transform active:scale-95"
                >
                  Voir les véhicules d&apos;occasion
                </Link>
                <Link
                  href="/comparatif"
                  className="rounded-full border border-surface-container bg-white px-5 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary"
                >
                  Comparer deux modèles
                </Link>
              </div>
            </section>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

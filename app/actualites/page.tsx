/**
 * Le fil d'actualité automobile de Deal&Co.
 *
 * ── Ce que cette page est ─────────────────────────────────────────────────
 *
 * Une revue de presse, tenue à jour toutes les heures à partir des flux que les
 * médias publient pour être repris. Chaque entrée porte sa signature, sa date
 * et son heure, et mène à une page qui renvoie à l'article d'origine.
 *
 * ── Pourquoi elle s'indexe, elle ──────────────────────────────────────────
 *
 * Parce qu'elle est de nous. Le choix des sources, le rapprochement avec notre
 * stock, l'organisation par marque : c'est un travail éditorial, et il change
 * plusieurs fois par jour. C'est exactement le genre de page qu'un moteur
 * revisite souvent — et c'est là que se gagne la fraîcheur, pas en multipliant
 * des pages qui reprennent le résumé d'un autre.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import ArticleCard from "@/components/news/ArticleCard";
import { getNewsFeed, coveredBrands, countArticles } from "@/lib/news/articles";
import { frDateTime } from "@/lib/news/format";
import { safeJsonLd } from "@/lib/json-ld";

const BASE = "https://www.dealandcompany.fr";

/** Un quart d'heure : le cron capte toutes les heures, la page suit de près. */
export const revalidate = 900;

export const metadata: Metadata = {
  title: "Actualité automobile — essais, nouveautés et vidéos",
  description:
    "La revue de presse automobile de Deal&Co : essais, nouveautés et vidéos de la presse spécialisée, mis à jour chaque heure, avec les annonces d'occasion correspondantes.",
  alternates: {
    canonical: `${BASE}/actualites`,
    types: { "application/atom+xml": `${BASE}/actualites/feed.xml` },
  },
  openGraph: {
    title: "Actualité automobile — Deal&Co",
    description: "Essais, nouveautés et vidéos de la presse spécialisée, mis à jour chaque heure.",
    url: `${BASE}/actualites`,
    siteName: "Deal&Co",
    locale: "fr_FR",
    type: "website",
  },
};

export default async function ActualitesPage() {
  const [articles, brands, total] = await Promise.all([
    getNewsFeed(null, 25),
    coveredBrands(2),
    countArticles(null),
  ]);

  const [lead, ...rest] = articles;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Actualité automobile",
    url: `${BASE}/actualites`,
    description:
      "Revue de presse automobile : essais, nouveautés et vidéos de la presse spécialisée.",
    ...(lead ? { dateModified: lead.publishedAt.toISOString() } : {}),
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
            Actualité automobile
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            Notre revue de la presse spécialisée : essais, nouveautés et vidéos, avec
            pour chaque sujet les annonces d&apos;occasion que nous avons en ligne.
            Chaque article renvoie à sa source.
          </p>
          {lead && (
            <p className="mt-2 text-xs text-outline">
              {total} article{total > 1 ? "s" : ""} suivis · dernière mise à jour{" "}
              <time dateTime={lead.publishedAt.toISOString()}>{frDateTime(lead.publishedAt)}</time>
            </p>
          )}
        </header>

        {articles.length === 0 ? (
          <p className="rounded-2xl border border-surface-container bg-white p-6 text-sm text-on-surface-variant">
            La revue de presse est en cours de constitution. Revenez d&apos;ici peu.
          </p>
        ) : (
          <>
            {brands.length > 0 && (
              <nav aria-label="Marques suivies" className="mb-8 flex flex-wrap gap-2">
                {brands.slice(0, 16).map((b) => (
                  <Link
                    key={b.brandSlug}
                    href={`/actualites/marque/${b.brandSlug}`}
                    className="rounded-full border border-surface-container bg-white px-3 py-1.5 text-xs font-semibold capitalize text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {b.brandSlug.replace(/-/g, " ")}{" "}
                    <span className="text-outline">({b.count})</span>
                  </Link>
                ))}
              </nav>
            )}

            {lead && (
              <div className="mb-8">
                {/* Le premier article passe en pleine largeur : un fil qui
                    commence par une grille uniforme ne dit pas ce qui vient
                    d'arriver. */}
                <div className="md:grid md:grid-cols-2 md:gap-6">
                  <ArticleCard article={lead} priority />
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 md:mt-0">
                    {rest.slice(0, 2).map((a) => (
                      <ArticleCard key={a.slug} article={a} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.slice(2).map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

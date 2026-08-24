/**
 * Deal&Co Info — la une.
 *
 * ── Ce que cette page est ─────────────────────────────────────────────────
 *
 * Une revue de presse, tenue à jour toutes les heures à partir des flux que les
 * médias publient pour être repris. Chaque entrée porte sa signature, sa date
 * et son heure, et mène à une page qui renvoie à l'article d'origine.
 *
 * Elle n'est pas que automobile, et c'est délibéré : Deal&Co vend aussi mode,
 * maison, multimédia, loisirs et animaux. Une revue de presse limitée aux
 * voitures serait plus étroite que le site qui la porte.
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
import { INFO_SECTIONS, INFO_SECTION_SLUGS } from "@/lib/news/sources";
import { frDateTime } from "@/lib/news/format";
import { safeJsonLd } from "@/lib/json-ld";

const BASE = "https://www.dealandcompany.fr";

/** Un quart d'heure : le cron capte toutes les heures, la page suit de près. */
export const revalidate = 900;

export const metadata: Metadata = {
  title: "Deal&Co Info — l'actualité du jour",
  description:
    "Deal&Co Info : l'actualité française et automobile, mise à jour chaque heure à partir des flux de la presse. Essais, nouveautés, société, économie, high-tech et sport, avec les annonces correspondantes.",
  alternates: {
    canonical: `${BASE}/actualites`,
    types: { "application/atom+xml": `${BASE}/actualites/feed.xml` },
  },
  openGraph: {
    title: "Deal&Co Info",
    description: "L'actualité du jour, mise à jour chaque heure à partir des flux de la presse.",
    url: `${BASE}/actualites`,
    siteName: "Deal&Co",
    locale: "fr_FR",
    type: "website",
  },
};

export default async function ActualitesPage() {
  const [articles, brands, total, sections] = await Promise.all([
    getNewsFeed(null, 13, 0, INFO_SECTION_SLUGS),
    coveredBrands(2),
    countArticles(null),
    // Une rubrique par flux d'origine : c'est le média qui range ses articles,
    // et il le fait mieux qu'un classement deviné après coup.
    Promise.all(
      INFO_SECTIONS.map(async (section) => ({
        ...section,
        articles: await getNewsFeed(null, 4, 0, section.slug),
      })),
    ),
  ]);

  const [lead, ...rest] = articles;
  const leadUrls = new Set(articles.map((a) => a.slug));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Deal&Co Info",
    url: `${BASE}/actualites`,
    description:
      "Revue de presse : actualité française et automobile, mise à jour chaque heure.",
    ...(lead ? { dateModified: lead.publishedAt.toISOString() } : {}),
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 pt-32 pb-16">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
            Deal&amp;Co Info
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            L&apos;actualité du jour, reprise des flux que la presse publie pour être
            reprise. Chaque article porte sa signature, sa date, son heure, et renvoie
            à sa source. Pour l&apos;automobile, c&apos;est{" "}
            <Link href="/actualites/auto" className="font-semibold text-primary hover:underline">
              Deal&amp;Co Auto
            </Link>
            .
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
            <nav aria-label="Rubriques" className="mb-8 flex flex-wrap gap-2 border-b border-surface-container pb-4">
              {sections
                .filter((s) => s.articles.length > 0)
                .map((s) => (
                  <Link
                    key={s.slug}
                    href={`/actualites/rubrique/${s.slug}`}
                    className="rounded-full bg-surface-container px-4 py-2 text-xs font-bold uppercase tracking-wide text-on-surface transition-colors hover:bg-primary hover:text-white"
                  >
                    {s.label}
                  </Link>
                ))}
              {/* L'auto sort de la grille : elle a sa propre une, avec ses
                  cotes et ses annonces. Le lien reste, parce qu'un lecteur qui
                  passe par ici doit pouvoir y aller. */}
              <Link
                href="/actualites/auto"
                className="rounded-full border border-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary transition-colors hover:bg-primary hover:text-white"
              >
                Deal&amp;Co Auto →
              </Link>
            </nav>

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

            {/* Une bande par rubrique. Les articles déjà en tête de page en
                sont retirés : voir deux fois le même titre à trente centimètres
                d'écart donne l'impression d'un site mal tenu. */}
            {sections.map((section) => {
              const items = section.articles.filter((a) => !leadUrls.has(a.slug)).slice(0, 3);
              if (items.length === 0) return null;
              return (
                <section key={section.slug} className="mt-12">
                  <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-surface-container pb-2">
                    <h2 className="text-xl font-extrabold tracking-tight text-on-surface">
                      {section.label}
                    </h2>
                    <Link
                      href={`/actualites/rubrique/${section.slug}`}
                      className="shrink-0 text-sm font-semibold text-primary hover:underline"
                    >
                      Tout voir →
                    </Link>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((a) => (
                      <ArticleCard key={a.slug} article={a} />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

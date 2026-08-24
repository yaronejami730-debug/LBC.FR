/**
 * Revue de presse d'une marque — `/actualites/marque/renault`.
 *
 * ── Pourquoi ces pages existent ───────────────────────────────────────────
 *
 * Parce qu'elles répondent à une question que personne d'autre ne traite d'un
 * seul tenant : « qu'est-ce qui se dit sur Renault, et qu'est-ce qu'on trouve
 * en occasion ? ». Le média a la première moitié, nous avons la seconde.
 *
 * Elles ne s'indexent qu'au-dessus d'un vrai volume : une page « revue de
 * presse » avec deux articles n'est pas une revue de presse.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import ArticleCard from "@/components/news/ArticleCard";
import { getNewsFeed, coveredBrands, countArticles } from "@/lib/news/articles";
import { frDateTime } from "@/lib/news/format";
import { CAR_BRANDS } from "@/lib/carBrands";
import { normalizeToken } from "@/lib/seo/city";

const BASE = "https://www.dealandcompany.fr";

export const revalidate = 900;

/**
 * En dessous, la page existe pour le visiteur mais ne demande pas l'index.
 *
 * Non exporté : Next refuse tout export inattendu depuis un fichier `page.tsx`.
 */
const MIN_ARTICLES_TO_INDEX = 4;

function brandName(slug: string): string | null {
  return CAR_BRANDS.find((b) => normalizeToken(b.name) === slug)?.name ?? null;
}

export async function generateStaticParams() {
  const brands = await coveredBrands(MIN_ARTICLES_TO_INDEX);
  return brands.map((b) => ({ marque: b.brandSlug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ marque: string }>;
}): Promise<Metadata> {
  const { marque } = await params;
  const name = brandName(marque);
  if (!name) return {};

  const total = await countArticles(marque);

  return {
    title: `Actualité ${name} — essais, nouveautés et occasions`,
    description: `Toute l'actualité ${name} suivie par Deal&Co : essais, nouveautés et vidéos de la presse spécialisée, et les ${name} d'occasion en vente entre particuliers.`,
    alternates: { canonical: `${BASE}/actualites/marque/${marque}` },
    robots: total >= MIN_ARTICLES_TO_INDEX ? undefined : { index: false, follow: true },
  };
}

export default async function BrandNewsPage({
  params,
}: {
  params: Promise<{ marque: string }>;
}) {
  const { marque } = await params;
  const name = brandName(marque);
  if (!name) notFound();

  const articles = await getNewsFeed(marque, 24);
  // Aucune actualité : la page n'a rien à montrer, elle ne doit pas exister.
  if (articles.length === 0) notFound();

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <nav className="mb-4 text-xs text-outline">
          <Link href="/actualites" className="hover:text-primary">
            Actualité automobile
          </Link>
          <span className="mx-1.5">›</span>
          <span>{name}</span>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
            Actualité {name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            Ce que la presse spécialisée écrit sur {name}, suivi en continu par
            Deal&amp;Co. Chaque article renvoie à sa source.
          </p>
          <p className="mt-2 text-xs text-outline">
            {articles.length} article{articles.length > 1 ? "s" : ""} · dernier daté du{" "}
            <time dateTime={articles[0].publishedAt.toISOString()}>
              {frDateTime(articles[0].publishedAt)}
            </time>
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a, i) => (
            <ArticleCard key={a.slug} article={a} priority={i === 0} />
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-surface-container bg-white p-6">
          <h2 className="text-lg font-bold text-on-surface">
            {name} d&apos;occasion entre particuliers
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Toutes les annonces {name} en ligne sur Deal&amp;Co, sans commission.
          </p>
          <Link
            href={`/annonces/vehicules/${marque}`}
            className="mt-4 inline-block rounded-full bg-primary px-6 py-3 text-sm font-bold text-white shadow-md shadow-primary/20 transition-transform active:scale-95"
          >
            Voir les {name} d&apos;occasion
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

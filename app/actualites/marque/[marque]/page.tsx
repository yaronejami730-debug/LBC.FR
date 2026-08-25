/**
 * Revue de presse d'une marque — `/actualites/marque/renault`.
 *
 * ── Pourquoi ces pages existent ───────────────────────────────────────────
 *
 * Parce qu'elles répondent à une question que personne d'autre ne traite d'un
 * seul tenant : « qu'est-ce qui se dit sur Renault, et qu'est-ce qu'on trouve
 * en occasion ? ». Le média a la première moitié, nous avons la seconde.
 *
 * Elles s'indexent dès qu'elles ont des articles : chacun y arrive daté,
 * signé, illustré et cité sur une dizaine de lignes, à côté du stock réel.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import ArticleCard from "@/components/news/ArticleCard";
import { getNewsFeed, coveredBrands, countArticles } from "@/lib/news/articles";
import { newsMetadata, collectionJsonLd, breadcrumbJsonLd } from "@/lib/news/seo";
import { safeJsonLd } from "@/lib/json-ld";
import { frDateTime } from "@/lib/news/format";
import { CAR_BRANDS } from "@/lib/carBrands";
import { normalizeToken } from "@/lib/seo/city";

export const revalidate = 300;

/**
 * Le seuil d'indexation a disparu, et son remplaçant est plus simple : une
 * page de marque existe quand elle a des articles, et une page qui existe
 * demande l'index. Le seuil de quatre articles qui vivait ici écartait des
 * pages qui montrent déjà, dès le premier, un titre daté, signé, une photo et
 * une dizaine de lignes de texte — plus le stock que nous en avons.
 *
 * `MIN_ARTICLES_TO_PRERENDER` ne concerne plus que le pré-rendu : au-dessus, la
 * page est bâtie au build ; en dessous, à la demande. C'est une question de
 * temps de build, pas de référencement.
 *
 * Non exporté : Next refuse tout export inattendu depuis un fichier `page.tsx`.
 */
const MIN_ARTICLES_TO_PRERENDER = 4;

function brandName(slug: string): string | null {
  return CAR_BRANDS.find((b) => normalizeToken(b.name) === slug)?.name ?? null;
}

export async function generateStaticParams() {
  const brands = await coveredBrands(MIN_ARTICLES_TO_PRERENDER);
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

  const [total, articles] = await Promise.all([
    countArticles(marque),
    getNewsFeed(marque, 1),
  ]);

  return newsMetadata({
    title: `Actualité ${name} — essais, nouveautés et ${name} d'occasion`,
    description: `Toute l'actualité ${name} suivie par Deal&Co : ${total} articles de la presse spécialisée, datés et signés, et les ${name} d'occasion en vente entre particuliers avec leur cote.`,
    path: `/actualites/marque/${marque}`,
    image: articles[0]?.imageUrl,
    publishedAt: articles[0]?.publishedAt,
  });
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

  const jsonLd = collectionJsonLd({
    name: `Actualité ${name}`,
    description: `La revue de presse ${name} de Deal&Co, avec les ${name} d'occasion en vente.`,
    path: `/actualites/marque/${marque}`,
    articles,
  });

  const breadcrumb = breadcrumbJsonLd([
    { name: "Accueil", path: "" },
    { name: "Deal&Co Auto", path: "/actualites/auto" },
    { name, path: `/actualites/marque/${marque}` },
  ]);

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }} />
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 pt-32 pb-16">
        <nav className="mb-4 text-xs text-outline">
          <Link href="/actualites/auto" className="hover:text-primary">
            Deal&amp;Co Auto
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

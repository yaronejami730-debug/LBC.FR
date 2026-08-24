/**
 * Page d'un article capté.
 *
 * ── Ce que cette page affiche, et sous quel nom ───────────────────────────
 *
 * Le visuel et le résumé publiés par le média dans son flux, sa signature, la
 * date **et l'heure** de publication, puis un renvoi bien visible vers
 * l'article complet chez lui. Le texte intégral n'est jamais repris : il n'est
 * pas dans le flux, et l'aspirer serait de la contrefaçon.
 *
 * Aucune signature Deal&Co n'apparaît, et aucun balisage `NewsArticle` n'est
 * émis : nous ne sommes pas l'auteur, le déclarer à Google serait faux.
 *
 * ── Ce que la page ajoute ─────────────────────────────────────────────────
 *
 * Les annonces que nous avons sur le sujet, et la cote du modèle. C'est ce qui
 * la rend utile — et, au-delà d'un seuil d'annonces, indexable.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import ListingCard from "@/components/home/ListingCard";
import ArticleCard from "@/components/news/ArticleCard";
import {
  getArticle,
  relatedArticles,
  relatedListings,
  isArticleIndexable,
} from "@/lib/news/articles";
import { byline, frDate, frTime } from "@/lib/news/format";
import { safeJsonLd } from "@/lib/json-ld";

const BASE = "https://www.dealandcompany.fr";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return {};

  const listings = await relatedListings(article, 3);
  const indexable = isArticleIndexable(listings.length);

  return {
    title: article.title,
    description:
      article.summary ??
      `${article.title} — revue de presse Deal&Co, publié par ${article.publisher}.`,
    alternates: { canonical: `${BASE}/actualites/${article.slug}` },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: {
      title: article.title,
      description: article.summary ?? undefined,
      url: `${BASE}/actualites/${article.slug}`,
      siteName: "Deal&Co",
      locale: "fr_FR",
      type: "article",
      publishedTime: article.publishedAt.toISOString(),
      images: article.imageUrl ? [article.imageUrl] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const [listings, others] = await Promise.all([
    relatedListings(article, 8),
    relatedArticles(article, 3),
  ]);

  const marque = article.brandSlug?.replace(/-/g, " ");
  const modele = article.modelSlug?.replace(/-/g, " ");
  const priceSlug = article.brandSlug && article.modelSlug
    ? `${article.brandSlug}-${article.modelSlug}-occasion`
    : null;

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
      { "@type": "ListItem", position: 2, name: "Actualité automobile", item: `${BASE}/actualites` },
      { "@type": "ListItem", position: 3, name: article.title, item: `${BASE}/actualites/${article.slug}` },
    ],
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }} />
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <nav className="mb-4 text-xs text-outline">
          <Link href="/actualites" className="hover:text-primary">
            Actualité automobile
          </Link>
          {marque && (
            <>
              <span className="mx-1.5">›</span>
              <Link href={`/actualites/marque/${article.brandSlug}`} className="capitalize hover:text-primary">
                {marque}
              </Link>
            </>
          )}
        </nav>

        <article>
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-on-surface md:text-3xl">
            {article.title}
          </h1>

          {/* Auteur, jour et heure : les trois mentions ne se séparent jamais. */}
          <p className="mt-3 text-sm text-on-surface-variant">
            Par <strong className="font-semibold">{byline(article.authorName, article.publisher)}</strong>
            {" — publié le "}
            <time dateTime={article.publishedAt.toISOString()}>
              {frDate(article.publishedAt)} à {frTime(article.publishedAt)}
            </time>
          </p>

          <div className="mt-5 overflow-hidden rounded-2xl border border-surface-container bg-surface-container">
            {article.videoId ? (
              /* Lecteur YouTube intégré : la vidéo est lue depuis chez YouTube,
                 avec ses vues et son lien de chaîne. Rien n'est réhébergé, et
                 `nocookie` évite de poser un traceur avant lecture. */
              <div className="relative aspect-video">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${article.videoId}`}
                  title={article.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>
            ) : (
              article.imageUrl && (
                <div className="relative aspect-[16/9]">
                  <Image
                    src={article.imageUrl}
                    alt={article.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 768px"
                    quality={75}
                    priority
                    className="object-cover"
                  />
                </div>
              )
            )}
          </div>

          {article.imageUrl && !article.videoId && (
            <p className="mt-2 text-[11px] text-outline">Photo : {article.publisher}</p>
          )}

          {article.summary && (
            <p className="mt-5 text-base leading-relaxed text-on-surface-variant">{article.summary}</p>
          )}

          <div className="mt-6 rounded-2xl border border-surface-container bg-white p-5">
            <p className="text-sm text-on-surface-variant">
              Cet article a été écrit et publié par{" "}
              <a
                href={article.publisherHome}
                target="_blank"
                rel="noopener"
                className="font-semibold text-primary hover:underline"
              >
                {article.publisher}
              </a>
              . Deal&amp;Co en présente le résumé et le visuel diffusés par le média, et
              renvoie vers la version complète.
            </p>
            <a
              href={article.url}
              target="_blank"
              rel="noopener"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white shadow-md shadow-primary/20 transition-transform active:scale-95"
            >
              Lire l&apos;article complet sur {article.publisher}
              <span className="material-symbols-outlined text-base">open_in_new</span>
            </a>
          </div>
        </article>

        {listings.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-on-surface">
              {modele ? `${marque} ${modele}` : marque} d&apos;occasion sur Deal&amp;Co
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {listings.length} annonce{listings.length > 1 ? "s" : ""} entre particuliers,
              en ligne aujourd&apos;hui.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
            {priceSlug && (
              <Link
                href={`/prix/${priceSlug}`}
                className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
              >
                Voir la cote {marque} {modele} d&apos;occasion →
              </Link>
            )}
          </section>
        )}

        {others.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-on-surface">
              {marque ? <span className="capitalize">{marque}</span> : "Dans la même revue"}
              {marque ? " : à lire aussi" : ""}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {others.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          </section>
        )}

      </main>

      <SiteFooter />
    </div>
  );
}

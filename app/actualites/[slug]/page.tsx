/**
 * Page d'un article capté.
 *
 * ── Ce que cette page affiche, et sous quel nom ───────────────────────────
 *
 * Le visuel du flux, le chapô, puis une **citation d'une quinzaine de lignes**
 * du corps de l'article, encadrée comme telle et suivie du renvoi vers
 * l'original. La signature reste celle du média, la date porte l'heure, et un
 * bouton bien visible mène à l'article complet chez lui.
 *
 * La citation vient du flux quand le média y publie son texte — un seul le fait
 * sur les seize mesurés — et de la page publique de l'article sinon. Dans les
 * deux cas elle est bornée à la même proportion : 45 % du texte, 1 500
 * caractères au plus, jamais plus de 60 % d'un article court. Voir
 * `lib/news/fulltext.ts` pour ce que cette lecture fait et ne fait pas.
 *
 * Aucune signature Deal&Co n'apparaît nulle part. Le balisage `NewsArticle`
 * nomme le journaliste en `author`, son média en `publisher`, et pointe
 * l'original en `isBasedOn` : un moteur y lit une revue de presse attribuée,
 * ce qu'elle est.
 *
 * ── Ce que la page ajoute ─────────────────────────────────────────────────
 *
 * Les annonces que nous avons sur le sujet, la cote du modèle, le fil de la
 * marque. C'est ce qui la rend utile, et ce qui justifie qu'elle demande
 * l'index — sans seuil, désormais : voir `lib/news/seo.ts`.
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
  videoFor,
  brandStats,
  brandTimeline,
} from "@/lib/news/articles";
import { newsMetadata, breadcrumbJsonLd, articleJsonLd } from "@/lib/news/seo";
import { getPriceQuote } from "@/lib/seo/price";
import { byline, frDate, frTime, paragraphs } from "@/lib/news/format";
import { sectionLabel } from "@/lib/news/sources";
import { safeJsonLd } from "@/lib/json-ld";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return {};

  // La description reprend le chapô du média quand il en publie un, et le
  // début de la citation sinon. Jamais un texte fabriqué pour remplir : une
  // description inventée finit par décrire une page qui n'existe pas.
  const description =
    article.summary ??
    article.excerpt?.split("\n")[0].slice(0, 300) ??
    `${article.title} — revue de presse Deal&Co, article publié par ${article.publisher}.`;

  return newsMetadata({
    title: article.title,
    description,
    path: `/actualites/${article.slug}`,
    image: article.imageUrl,
    publishedAt: article.publishedAt,
    type: "article",
  });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const marque = article.brandSlug?.replace(/-/g, " ");
  const modele = article.modelSlug?.replace(/-/g, " ");
  const priceSlug =
    article.brandSlug && article.modelSlug
      ? `${article.brandSlug}-${article.modelSlug}-occasion`
      : null;

  // Tout ce que la page ajoute à l'article vient d'ici, et tout est réel :
  // notre stock, notre cote, nos vidéos. Rien n'est rédigé pour faire volume.
  const [listings, others, video, stats, timeline, quote] = await Promise.all([
    relatedListings(article, 8),
    relatedArticles(article, 3),
    videoFor(article),
    article.brandSlug ? brandStats(article.brandSlug) : null,
    article.brandSlug ? brandTimeline(article.brandSlug, article.slug, 6) : [],
    priceSlug ? getPriceQuote(priceSlug).catch(() => null) : null,
  ]);

  const euros = (n: number) => `${n.toLocaleString("fr-FR")} €`;

  const breadcrumb = breadcrumbJsonLd([
    { name: "Accueil", path: "" },
    { name: "Deal&Co Info", path: "/actualites" },
    ...(article.section === "auto"
      ? [{ name: "Deal&Co Auto", path: "/actualites/auto" }]
      : [{ name: sectionLabel(article.section) ?? "Actualités", path: `/actualites/rubrique/${article.section}` }]),
    { name: article.title, path: `/actualites/${article.slug}` },
  ]);

  // Ce balisage n'affirme que des choses vraies : l'auteur est le journaliste,
  // l'éditeur est son média, l'original est chez lui. Voir `lib/news/seo.ts`.
  const newsJsonLd = articleJsonLd(article, article.excerpt?.length ?? 0);

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(newsJsonLd) }} />
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 pt-32 pb-16">
        <nav className="mb-4 text-xs text-outline">
          <Link href="/actualites" className="hover:text-primary">
            Deal&amp;Co Info
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
            <p className="mt-5 text-base font-medium leading-relaxed text-on-surface">
              {article.summary}
            </p>
          )}

          {/* ── L'extrait ────────────────────────────────────────────────────
              Le flux de certains médias livre l'article entier. Le livrer n'est
              pas le céder : ces flux portent une mention de copyright. Ce qui
              s'affiche ici est donc une citation bornée, encadrée comme telle,
              suivie du renvoi vers l'article complet. C'est ce que le droit de
              courte citation autorise, et c'est où s'arrête ce que nous
              publions du travail d'un autre. */}
          {article.excerpt && (
            <figure className="mt-6">
              <blockquote className="space-y-4 border-l-4 border-primary/30 pl-5 text-[17px] leading-[1.75] text-on-surface">
                {paragraphs(article.excerpt).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </blockquote>
              <figcaption className="mt-3 pl-5 text-xs text-outline">
                Extrait de l&apos;article de {article.publisher}
                {article.authorName ? `, par ${article.authorName}` : ""}.{" "}
                <a href={article.url} target="_blank" rel="noopener" className="font-semibold text-primary hover:underline">
                  Lire la suite chez {article.publisher} ↗
                </a>
              </figcaption>
            </figure>
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

        {/* ── La cote ──────────────────────────────────────────────────────
            Le chiffre que le média n'a pas : ce que le modèle vaut réellement
            sur notre marché, vendues comprises. */}
        {quote && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-on-surface">
              Combien vaut un{modele ? ` ${marque} ${modele}` : ""} d&apos;occasion ?
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Cote établie sur {quote.observations.toLocaleString("fr-FR")} annonces entre
              particuliers, annonces vendues comprises.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: "Prix le plus bas", value: quote.min },
                { label: "Prix moyen", value: quote.average, highlight: true },
                { label: "Prix le plus haut", value: quote.max },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={`rounded-2xl border p-4 text-center ${
                    stat.highlight
                      ? "border-primary bg-primary text-white shadow-lg shadow-primary/20"
                      : "border-surface-container bg-white"
                  }`}
                >
                  <p
                    className={`text-xl font-extrabold ${stat.highlight ? "text-white" : "text-primary"}`}
                  >
                    {euros(stat.value)}
                  </p>
                  <p className={`mt-1 text-xs ${stat.highlight ? "text-white/80" : "text-outline"}`}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
            {priceSlug && (
              <Link
                href={`/prix/${priceSlug}`}
                className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
              >
                Voir la cote détaillée {marque} {modele} →
              </Link>
            )}
          </section>
        )}

        {/* ── La vidéo du même sujet ───────────────────────────────────────
            Prise dans notre propre base, jamais cherchée à la volée : ce qui
            s'affiche ici a été capté, daté et signé comme le reste. */}
        {video && video.videoId && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-on-surface">
              {marque ? <span className="capitalize">{marque}</span> : "Sur le même sujet"} en vidéo
            </h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-surface-container">
              <div className="relative aspect-video">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${video.videoId}`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>
            </div>
            <p className="mt-2 text-sm font-semibold text-on-surface">{video.title}</p>
            <p className="text-xs text-outline">
              {byline(video.authorName, video.publisher)} —{" "}
              <time dateTime={video.publishedAt.toISOString()}>
                {frDate(video.publishedAt)} à {frTime(video.publishedAt)}
              </time>
            </p>
          </section>
        )}

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

        {/* ── Le marché de la marque chez nous ────────────────────────── */}
        {stats && (
          <section className="mt-10 rounded-2xl border border-surface-container bg-white p-6">
            <h2 className="text-lg font-bold text-on-surface">
              Le marché {stats.name} d&apos;occasion sur Deal&amp;Co
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              {stats.count} annonce{stats.count > 1 ? "s" : ""} {stats.name} en ligne
              aujourd&apos;hui, entre {euros(stats.minPrice)} et {euros(stats.maxPrice)},
              pour un prix moyen de <strong>{euros(stats.avgPrice)}</strong>. Toutes sont
              publiées par des particuliers, sans commission.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/annonces/vehicules/${article.brandSlug}`}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20 transition-transform active:scale-95"
              >
                Voir les {stats.name} d&apos;occasion
              </Link>
              <Link
                href={`/actualites/marque/${article.brandSlug}`}
                className="rounded-full border border-surface-container bg-white px-5 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary"
              >
                Toute l&apos;actualité {stats.name}
              </Link>
            </div>
          </section>
        )}

        {/* ── Le fil de la marque ──────────────────────────────────────────
            Une liste datée, pas des cartes : elle donne la chronologie d'un
            coup d'œil, ce qu'une grille d'images ne fait pas. */}
        {timeline.length > 2 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-on-surface">
              Le fil <span className="capitalize">{marque}</span>
            </h2>
            <ol className="mt-4 space-y-3">
              {timeline.map((t) => (
                <li key={t.slug} className="border-t border-surface-container pt-3 first:border-t-0 first:pt-0">
                  <Link
                    href={`/actualites/${t.slug}`}
                    className="text-sm font-semibold text-on-surface hover:text-primary hover:underline"
                  >
                    {t.title}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-outline">
                    {byline(t.authorName, t.publisher)} —{" "}
                    <time dateTime={t.publishedAt.toISOString()}>
                      {frDate(t.publishedAt)} à {frTime(t.publishedAt)}
                    </time>
                  </p>
                </li>
              ))}
            </ol>
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

/**
 * La section actualités : lecture pour les pages publiques.
 *
 * ── Ce que Deal&Co publie, et sous quelle signature ───────────────────────
 *
 * Chaque article capté a sa page chez nous : grande photo, titre, résumé, date,
 * puis les annonces que nous avons sur le sujet. La photo et le résumé viennent
 * du flux — ce que le média met dans un flux, il le met pour être repris.
 *
 * Ce qui n'arrive jamais : la signature reste celle du média, et un bouton bien
 * visible renvoie à l'article complet chez lui. Nous présentons son travail,
 * nous ne le revendiquons pas. C'est autant une question de droit d'auteur que
 * de crédibilité : un lecteur qui reconnaît un article de Motor1 signé Deal&Co
 * n'accorde plus grand-chose au reste du site.
 *
 * ── Ce que la page apporte que le média n'a pas ───────────────────────────
 *
 * Le stock. Un article sur le duel MG ZS / Dacia Duster est suivi, chez nous,
 * des Duster réellement en vente et de leur cote. C'est la moitié que Motor1
 * ne peut pas écrire, et c'est elle qui justifie la page.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sourceByKey } from "@/lib/news/sources";
import { youtubeIdOf } from "@/lib/news/parse";
import type { NewsKind } from "@/lib/news/sources";

export type Article = {
  slug: string;
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: Date;
  brandSlug: string | null;
  modelSlug: string | null;
  publisher: string;
  publisherHome: string;
  kind: NewsKind;
  /** Signature réelle, ou `null` si le média ne la publie pas. */
  authorName: string | null;
  /** Identifiant YouTube quand l'article est une vidéo — sert au lecteur intégré. */
  videoId: string | null;
};

const SELECT = {
  slug: true,
  title: true,
  summary: true,
  url: true,
  imageUrl: true,
  publishedAt: true,
  brandSlug: true,
  modelSlug: true,
  source: true,
  authorName: true,
} as const;

type Row = {
  slug: string | null;
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: Date;
  brandSlug: string | null;
  modelSlug: string | null;
  source: string;
  authorName: string | null;
};

function toArticle(row: Row): Article | null {
  const source = sourceByKey(row.source);
  // Sans slug ou sans source connue, la page n'a ni adresse ni signature :
  // elle ne peut pas exister.
  if (!row.slug || !source) return null;
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    url: row.url,
    imageUrl: row.imageUrl,
    publishedAt: row.publishedAt,
    brandSlug: row.brandSlug,
    modelSlug: row.modelSlug,
    publisher: source.publisher,
    publisherHome: source.homepage,
    kind: source.kind,
    authorName: row.authorName,
    videoId: source.kind === "video" ? youtubeIdOf(row.url) : null,
  };
}

/**
 * Le fil : les articles les plus récents, photo obligatoire.
 *
 * Une carte sans visuel casse une grille et n'attire personne ; un article sans
 * photo dans le flux n'a rien à faire dans un mur d'images. Il reste en base et
 * continue de compter dans la veille.
 */
async function computeFeed(brandSlug: string | null, take: number, skip: number) {
  const rows = await prisma.newsItem.findMany({
    where: {
      imageUrl: { not: null },
      slug: { not: null },
      ...(brandSlug ? { brandSlug } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take,
    skip,
    select: SELECT,
  });
  return rows.map(toArticle).filter((a): a is Article => a !== null);
}

/**
 * Le cache de Next sérialise en JSON : une `Date` en ressort en chaîne, et
 * `toISOString` n'existe plus dessus. Le rétablir ici, une fois, évite de
 * disséminer des `new Date(...)` défensifs dans chaque page — et évite surtout
 * la panne que cela a produite au premier build.
 */
function reviveDates(articles: Article[]): Article[] {
  return articles.map((a) => ({ ...a, publishedAt: new Date(a.publishedAt) }));
}

export async function getNewsFeed(brandSlug: string | null, take = 24, skip = 0) {
  const cached = await unstable_cache(
    () => computeFeed(brandSlug, take, skip),
    ["news-feed", brandSlug ?? "-", String(take), String(skip)],
    { revalidate: 1800, tags: ["news"] },
  )();
  return reviveDates(cached);
}

export async function countArticles(brandSlug: string | null): Promise<number> {
  return prisma.newsItem.count({
    where: { imageUrl: { not: null }, slug: { not: null }, ...(brandSlug ? { brandSlug } : {}) },
  });
}

export async function getArticle(slug: string): Promise<Article | null> {
  const row = await prisma.newsItem.findUnique({ where: { slug }, select: SELECT });
  return row ? toArticle(row) : null;
}

/** Les autres articles de la même marque — sinon les plus récents. */
export async function relatedArticles(article: Article, take = 4): Promise<Article[]> {
  const rows = await prisma.newsItem.findMany({
    where: {
      slug: { not: null },
      imageUrl: { not: null },
      NOT: { slug: article.slug },
      ...(article.brandSlug ? { brandSlug: article.brandSlug } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take,
    select: SELECT,
  });
  const out = rows.map(toArticle).filter((a): a is Article => a !== null);
  if (out.length > 0 || !article.brandSlug) return out;

  const fallback = await prisma.newsItem.findMany({
    where: { slug: { not: null }, imageUrl: { not: null }, NOT: { slug: article.slug } },
    orderBy: { publishedAt: "desc" },
    take,
    select: SELECT,
  });
  return fallback.map(toArticle).filter((a): a is Article => a !== null);
}

/** Marques couvertes par le fil, avec leur nombre d'articles. */
export async function coveredBrands(min = 2): Promise<{ brandSlug: string; count: number }[]> {
  const rows = await prisma.newsItem.groupBy({
    by: ["brandSlug"],
    where: { brandSlug: { not: null }, imageUrl: { not: null }, slug: { not: null } },
    _count: { _all: true },
  });
  return rows
    .filter((r) => r._count._all >= min)
    .map((r) => ({ brandSlug: r.brandSlug!, count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Les annonces que nous avons sur le sujet de l'article.
 *
 * C'est la moitié de la page que le média ne peut pas écrire, et la seule
 * raison valable pour que cette page existe chez nous plutôt que chez lui.
 * Recherche par modèle quand on le connaît, par marque sinon.
 */
export async function relatedListings(article: Article, take = 8) {
  if (!article.brandSlug) return [];

  const { CAR_BRANDS } = await import("@/lib/carBrands");
  const { normalizeToken } = await import("@/lib/seo/city");
  const brand = CAR_BRANDS.find((b) => normalizeToken(b.name) === article.brandSlug);
  if (!brand) return [];

  const terms = [brand.name, ...(article.modelSlug ? [article.modelSlug.replace(/-/g, " ")] : [])];

  return prisma.listing
    .findMany({
      where: {
        status: "APPROVED",
        deletedAt: null,
        category: "Véhicules",
        price: { gt: 0 },
        AND: terms.map((t) => ({ metadata: { contains: t, mode: "insensitive" } })),
      } as never,
      orderBy: [{ isPremium: "desc" }, { createdAt: "desc" }],
      take,
      select: {
        id: true,
        title: true,
        price: true,
        location: true,
        condition: true,
        images: true,
        createdAt: true,
        isPremium: true,
      },
    })
    .catch(() => []);
}

/**
 * Cette page mérite-t-elle l'index ?
 *
 * ── L'arbitrage, en clair ─────────────────────────────────────────────────
 *
 * Une page qui reprend le résumé d'un autre et rien d'autre est une page mince,
 * et Google la traite comme telle — pas seulement elle, mais le domaine qui en
 * publie beaucoup. C'est la règle que le site s'applique déjà à lui-même : 129
 * annonces importées sont hors index pour ce motif exact.
 *
 * La page devient indexable quand elle apporte ce que la source n'a pas : des
 * annonces réelles sur le sujet. En dessous, elle reste `noindex, follow` —
 * consultable, utile au visiteur, elle transmet ses liens, mais elle ne
 * demande pas à Google de la référencer.
 *
 * La fraîcheur, elle, ne passe pas par ces pages : elle passe par le fil
 * `/actualites`, ses hubs par marque et le flux Atom que nous publions.
 */
export const MIN_LISTINGS_TO_INDEX = 3;

export function isArticleIndexable(listingCount: number): boolean {
  return listingCount >= MIN_LISTINGS_TO_INDEX;
}

/**
 * Hubs marque assez fournis pour être recommandés à Google, avec la date du
 * dernier article — un `lastmod` vrai, jamais la date du jour recopiée.
 */
export async function indexableNewsBrands(
  min = 4,
): Promise<{ brandSlug: string; lastAt: Date }[]> {
  const rows = await prisma.newsItem.groupBy({
    by: ["brandSlug"],
    where: { brandSlug: { not: null }, imageUrl: { not: null }, slug: { not: null } },
    _count: { _all: true },
    _max: { publishedAt: true },
  });
  return rows
    .filter((r) => r._count._all >= min && r._max.publishedAt)
    .map((r) => ({ brandSlug: r.brandSlug!, lastAt: r._max.publishedAt! }));
}

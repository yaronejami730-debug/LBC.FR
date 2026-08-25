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
import { sourceByKey, sourceKeysOfSection } from "@/lib/news/sources";
import { youtubeIdOf } from "@/lib/news/parse";
import type { NewsKind } from "@/lib/news/sources";

export type Article = {
  slug: string;
  title: string;
  summary: string | null;
  /** Citation bornée du corps, quand le flux le publie. */
  excerpt: string | null;
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
  /** Rubrique de Deal&Co Info, héritée du flux d'origine. */
  section: string;
  /** Identifiant YouTube quand l'article est une vidéo — sert au lecteur intégré. */
  videoId: string | null;
};

const SELECT = {
  slug: true,
  title: true,
  summary: true,
  excerpt: true,
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
  excerpt: string | null;
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
    excerpt: row.excerpt,
    url: row.url,
    imageUrl: row.imageUrl,
    publishedAt: row.publishedAt,
    brandSlug: row.brandSlug,
    modelSlug: row.modelSlug,
    publisher: source.publisher,
    publisherHome: source.homepage,
    kind: source.kind,
    authorName: row.authorName,
    section: source.section,
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
async function computeFeed(
  brandSlug: string | null,
  take: number,
  skip: number,
  section: string | string[] | null = null,
) {
  const rows = await prisma.newsItem.findMany({
    where: {
      imageUrl: { not: null },
      slug: { not: null },
      ...(brandSlug ? { brandSlug } : {}),
      ...(section ? { source: { in: sourceKeysOfSection(section) } } : {}),
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

export async function getNewsFeed(
  brandSlug: string | null,
  take = 24,
  skip = 0,
  section: string | string[] | null = null,
) {
  const cached = await unstable_cache(
    () => computeFeed(brandSlug, take, skip, section),
    [
      "news-feed",
      brandSlug ?? "-",
      String(take),
      String(skip),
      Array.isArray(section) ? section.join("+") : (section ?? "-"),
    ],
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
 * Ce que la section propose au sitemap.
 *
 * ── Ce qui a changé, et pourquoi ──────────────────────────────────────────
 *
 * Le sitemap ne portait que les hubs de marque au-dessus de quatre articles.
 * Les pages d'article en étaient exclues, pour une raison qui se tenait à
 * l'époque : elles répondaient `noindex`, et recommander à Google des pages qui
 * refusent l'index abîme la confiance accordée à tout le fichier.
 *
 * Ce motif a disparu avec la règle qui le produisait. Une page d'article de
 * Deal&Co Info porte aujourd'hui une citation d'une quinzaine de lignes,
 * attribuée et datée, ses articles voisins, et le rapprochement avec notre
 * stock quand le sujet s'y prête. Elle demande l'index, donc elle entre au
 * sitemap — et sa date de publication y sert de `lastmod`, jamais la date du
 * jour recopiée.
 *
 * Les vidéos en sont exclues : la page n'est qu'un lecteur YouTube encadré,
 * c'est chez YouTube que la vidéo mérite d'être trouvée.
 */
export type NewsSitemapEntry = { path: string; lastAt: Date };

export async function newsSitemapEntries(): Promise<NewsSitemapEntry[]> {
  const { NEWS_SOURCES, INFO_SECTIONS, sourceKeysOfKind } = await import("@/lib/news/sources");

  const rows = await prisma.newsItem.findMany({
    where: {
      slug: { not: null },
      imageUrl: { not: null },
      source: { notIn: sourceKeysOfKind("video") },
    },
    orderBy: { publishedAt: "desc" },
    select: { slug: true, publishedAt: true, brandSlug: true, source: true },
  });
  if (rows.length === 0) return [];

  const entries: NewsSitemapEntry[] = rows.map((r) => ({
    path: `/actualites/${r.slug}`,
    lastAt: r.publishedAt,
  }));

  // Les deux unes et les rubriques, datées de leur article le plus récent :
  // c'est la seule date qui décrive vraiment ce que la page contient.
  const newestOf = (predicate: (row: (typeof rows)[number]) => boolean): Date | null =>
    rows.find(predicate)?.publishedAt ?? null;

  const sectionOf = new Map(NEWS_SOURCES.map((s) => [s.key, s.section]));

  const home = newestOf(() => true);
  if (home) entries.push({ path: "/actualites", lastAt: home });

  const auto = newestOf((r) => sectionOf.get(r.source) === "auto");
  if (auto) entries.push({ path: "/actualites/auto", lastAt: auto });

  for (const section of INFO_SECTIONS) {
    const last = newestOf((r) => sectionOf.get(r.source) === section.slug);
    if (last) entries.push({ path: `/actualites/rubrique/${section.slug}`, lastAt: last });
  }

  const brands = new Map<string, Date>();
  for (const row of rows) {
    if (row.brandSlug && !brands.has(row.brandSlug)) brands.set(row.brandSlug, row.publishedAt);
  }
  for (const [brandSlug, lastAt] of brands) {
    entries.push({ path: `/actualites/marque/${brandSlug}`, lastAt });
  }

  return entries;
}

/**
 * Une vidéo de notre base sur le même sujet, à intégrer dans un article écrit.
 *
 * Le modèle exact d'abord, la marque ensuite. Rien si la vidéo est l'article
 * lui-même — inutile de l'afficher deux fois.
 */
export async function videoFor(article: Article): Promise<Article | null> {
  if (article.kind === "video" || !article.brandSlug) return null;

  const pick = async (where: Record<string, unknown>) => {
    const row = await prisma.newsItem.findFirst({
      where: { ...where, slug: { not: null } },
      orderBy: { publishedAt: "desc" },
      select: SELECT,
    });
    return row ? toArticle(row) : null;
  };

  const videoSources = { source: { in: ["motor1-fr-video"] } };
  if (article.modelSlug) {
    const exact = await pick({
      ...videoSources,
      brandSlug: article.brandSlug,
      modelSlug: article.modelSlug,
    });
    if (exact) return exact;
  }
  return pick({ ...videoSources, brandSlug: article.brandSlug });
}

/**
 * Ce que notre marché dit de la marque : combien d'annonces, à quel prix.
 *
 * Chiffres réels, calculés sur les annonces en ligne. C'est la partie de la
 * page qu'aucun média ne peut écrire, et celle qui justifie qu'elle existe.
 */
export async function brandStats(brandSlug: string): Promise<{
  count: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  name: string;
} | null> {
  const { CAR_BRANDS } = await import("@/lib/carBrands");
  const { normalizeToken } = await import("@/lib/seo/city");
  const brand = CAR_BRANDS.find((b) => normalizeToken(b.name) === brandSlug);
  if (!brand) return null;

  const agg = await prisma.listing
    .aggregate({
      where: {
        status: "APPROVED",
        deletedAt: null,
        category: "Véhicules",
        price: { gt: 0 },
        metadata: { contains: brand.name, mode: "insensitive" },
      } as never,
      _count: { _all: true },
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true },
    })
    .catch(() => null);

  // Aucune annonce : pas de bloc plutôt qu'un bloc à zéro.
  if (!agg || agg._count._all === 0) return null;

  return {
    count: agg._count._all,
    avgPrice: Math.round(agg._avg.price ?? 0),
    minPrice: Math.round(agg._min.price ?? 0),
    maxPrice: Math.round(agg._max.price ?? 0),
    name: brand.name,
  };
}

/** Le fil récent de la marque, en version compacte. */
export async function brandTimeline(
  brandSlug: string,
  exceptSlug: string,
  take = 6,
): Promise<Article[]> {
  const rows = await prisma.newsItem.findMany({
    where: { brandSlug, slug: { not: null }, NOT: { slug: exceptSlug } },
    orderBy: { publishedAt: "desc" },
    take,
    select: SELECT,
  });
  return rows.map(toArticle).filter((a): a is Article => a !== null);
}

export type FeedHealth = {
  key: string;
  publisher: string;
  section: string;
  url: string;
  articles: number;
  /** Dernière fois que ce flux a été lu par la captation. */
  lastFetch: Date | null;
  /** Date du plus récent article capté sur ce flux. */
  lastArticle: Date | null;
};

/**
 * État de chaque flux, tel qu'on peut le prouver depuis la base.
 *
 * ── Ce que cet écran répond ───────────────────────────────────────────────
 *
 * « Comment être sûr que c'est branché ? » Un flux branché laisse deux traces
 * qu'on ne peut pas simuler : une **heure de dernière lecture** qui avance à
 * chaque passage, et un **dernier article** dont la date suit ce que le média
 * publie. Les deux sont lues ici directement dans la table, sans cache.
 *
 * Un flux dont la dernière lecture remonte à plus de deux heures est en panne :
 * le cron passe toutes les heures.
 */
export async function feedHealth(): Promise<FeedHealth[]> {
  const { NEWS_SOURCES } = await import("@/lib/news/sources");

  const rows = await prisma.newsItem.groupBy({
    by: ["source"],
    _count: { _all: true },
    _max: { fetchedAt: true, publishedAt: true },
  });

  return NEWS_SOURCES.map((source) => {
    const row = rows.find((r) => r.source === source.key);
    return {
      key: source.key,
      publisher: source.publisher,
      section: source.section,
      url: source.url,
      articles: row?._count._all ?? 0,
      lastFetch: row?._max.fetchedAt ?? null,
      lastArticle: row?._max.publishedAt ?? null,
    };
  });
}

/**
 * Lecture des actualités pour les pages publiques.
 *
 * ── La règle d'affichage, en une phrase ───────────────────────────────────
 *
 * Rien, ou quelque chose de vrai. Un bloc « Actualité » sans actualité récente
 * ne s'affiche pas : mieux vaut une page sans bloc qu'une page qui promet de la
 * fraîcheur et montre trois titres de l'an dernier.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sourceByKey, sourceKeysOfKind, MAX_AGE_DAYS, type NewsKind } from "@/lib/news/sources";
import { detectBrand } from "@/lib/news/match";

export type NewsCitation = {
  title: string;
  url: string;
  publishedAt: Date;
  publisher: string;
  publisherHome: string;
  /** Vrai quand l'article parle du modèle exact, faux quand il parle de la marque. */
  exact: boolean;
  kind: NewsKind;
};

/**
 * Filtre d'âge, une branche par nature de flux.
 *
 * Une seule fenêtre commune ne marchait pas : les rubriques essais de Motor1
 * sont des archives (mesuré le 24/08/2026 : l'essai de la Clio 2026 date de
 * mars, le guide Clio Williams de 2018), tandis que le flux général est frais
 * du jour. Une fenêtre de trois mois pour tout le monde vidait les pages
 * modèle ; une fenêtre de trois ans pour tout le monde aurait affiché comme
 * « actualité » un article sur un dirigeant parti depuis deux ans.
 */
function freshnessFilter() {
  const cutoff = (kind: NewsKind) =>
    new Date(Date.now() - MAX_AGE_DAYS[kind] * 24 * 3600 * 1000);
  return {
    OR: [
      { source: { in: sourceKeysOfKind("actualite") }, publishedAt: { gte: cutoff("actualite") } },
      { source: { in: sourceKeysOfKind("essai") }, publishedAt: { gte: cutoff("essai") } },
    ],
  };
}

/** Trois titres. Au-delà, le bloc cesse d'être une note et devient une liste de liens. */
const MAX_ITEMS = 3;

function decorate(rows: {
  title: string;
  url: string;
  publishedAt: Date;
  source: string;
  modelSlug: string | null;
}[]): NewsCitation[] {
  return rows.flatMap((r) => {
    const source = sourceByKey(r.source);
    // Source inconnue = source retirée de la configuration. On n'affiche pas un
    // lien dont on ne sait plus nommer l'auteur.
    if (!source) return [];
    return [
      {
        title: r.title,
        url: r.url,
        publishedAt: r.publishedAt,
        publisher: source.publisher,
        publisherHome: source.homepage,
        exact: r.modelSlug !== null,
        kind: source.kind,
      },
    ];
  });
}

async function computeNewsFor(brandSlug: string, modelSlug: string | null): Promise<NewsCitation[]> {
  const fresh = freshnessFilter();

  // Deux requêtes plutôt qu'un tri conditionnel : on veut d'abord tout ce qui
  // parle du modèle exact, et seulement ensuite compléter par la marque. Un
  // `ORDER BY` sur la date mélangerait les deux et pousserait une actualité de
  // marque devant un essai du modèle lui-même.
  const exact = modelSlug
    ? await prisma.newsItem.findMany({
        where: { brandSlug, modelSlug, ...fresh },
        orderBy: { publishedAt: "desc" },
        take: MAX_ITEMS,
        select: { title: true, url: true, publishedAt: true, source: true, modelSlug: true },
      })
    : [];

  if (exact.length >= MAX_ITEMS) return decorate(exact);

  const rest = await prisma.newsItem.findMany({
    where: {
      brandSlug,
      ...fresh,
      ...(exact.length > 0 ? { url: { notIn: exact.map((e) => e.url) } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: MAX_ITEMS - exact.length,
    select: { title: true, url: true, publishedAt: true, source: true, modelSlug: true },
  });

  return decorate([...exact, ...rest]);
}

/**
 * Actualités d'un modèle, en cache.
 *
 * Une heure : le flux est capté deux fois par jour, rafraîchir plus souvent
 * n'apporterait rien de plus qu'un aller-retour de base supplémentaire sur des
 * pages qui, elles, sont servies depuis le CDN.
 */
export async function getNewsFor(brandSlug: string, modelSlug: string | null) {
  const cached = await unstable_cache(
    () => computeNewsFor(brandSlug, modelSlug),
    ["news-for", brandSlug, modelSlug ?? "-"],
    { revalidate: 3600, tags: ["news"] },
  )();
  // Le cache rend les dates en chaînes : sans cette reprise, `toISOString`
  // casse au rendu de l'attribut `datetime`.
  return cached.map((c) => ({ ...c, publishedAt: new Date(c.publishedAt) }));
}

export type NewsTrend = {
  brandSlug: string;
  modelSlug: string | null;
  articles: number;
  /** Annonces en ligne chez nous sur ce couple marque/modèle. */
  listings: number;
  lastAt: Date;
};

/**
 * Ce dont la presse parle, croisé avec ce que nous avons en rayon.
 *
 * C'est la seule sortie de ce module qui serve à décider plutôt qu'à afficher.
 * Un sujet très couvert où nous avons du stock est un sujet éditorial à écrire
 * cette semaine ; très couvert sans stock, c'est un signal de recrutement
 * vendeurs. Les deux sont utiles, ils ne se traitent pas pareil.
 */
export async function newsTrends(days = 30): Promise<NewsTrend[]> {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const rows = await prisma.newsItem.groupBy({
    by: ["brandSlug", "modelSlug"],
    where: { publishedAt: { gte: since }, brandSlug: { not: null } },
    _count: { _all: true },
    _max: { publishedAt: true },
  });

  const listings = await prisma.listing.findMany({
    where: { status: "APPROVED" },
    select: { metadata: true },
    take: 20_000,
  });

  const { normalizeToken } = await import("@/lib/seo/city");
  const stock = new Map<string, number>();
  for (const row of listings) {
    try {
      const meta = JSON.parse(row.metadata ?? "{}");
      if (typeof meta?.marque !== "string") continue;
      const b = normalizeToken(meta.marque);
      const m = typeof meta?.modele === "string" ? normalizeToken(meta.modele) : "";
      stock.set(b, (stock.get(b) ?? 0) + 1);
      if (m) stock.set(`${b}/${m}`, (stock.get(`${b}/${m}`) ?? 0) + 1);
    } catch {
      continue;
    }
  }

  return rows
    .map((r) => {
      const brandSlug = r.brandSlug!;
      const key = r.modelSlug ? `${brandSlug}/${r.modelSlug}` : brandSlug;
      return {
        brandSlug,
        modelSlug: r.modelSlug,
        articles: r._count._all,
        listings: stock.get(key) ?? 0,
        lastAt: r._max.publishedAt ?? since,
      };
    })
    .sort((a, b) => b.articles - a.articles || b.listings - a.listings);
}

/**
 * Marque et modèle d'une page de cote `/prix/{slug}`.
 *
 * Le slug a été fabriqué par `priceSlug(marque, modele)` : marque et modèle
 * collés par des tirets, suffixe « -occasion ». On le défait dans le même
 * ordre — la marque en tête, le reste étant le modèle.
 */
export function brandModelFromPriceSlug(
  slug: string,
): { brandSlug: string; modelSlug: string | null } | null {
  const bare = slug.replace(/-occasion$/i, "");
  const brand = detectBrand(bare.replace(/-/g, " "));
  if (!brand) return null;

  // Le modèle est ce qui reste une fois la marque retirée du début.
  const rest = bare.startsWith(`${brand.slug}-`) ? bare.slice(brand.slug.length + 1) : "";
  return { brandSlug: brand.slug, modelSlug: rest || null };
}

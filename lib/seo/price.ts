/**
 * Pages de cote `/prix/{slug}` — critères d'existence et d'indexabilité.
 *
 * ── Le problème corrigé ───────────────────────────────────────────────────
 *
 * `/prix/peugeot-308-occasion` répondait `noindex` en dessous de trois annonces
 * **actives**, et `notFound()` à zéro. C'était appliquer à une page de contenu
 * la règle des pages de liste, et cela n'a pas de sens ici.
 *
 * « prix peugeot 308 occasion » est une requête à volume réel. La page qui y
 * répond se positionne sur ce qu'elle **sait** — la cote, sa fourchette, son
 * explication — pas sur ce qu'elle a en rayon aujourd'hui. C'est même tout son
 * intérêt : elle capte une demande que l'inventaire ne peut pas servir, et la
 * transforme en signal exploitable côté recrutement vendeurs.
 *
 * ── Le critère retenu ─────────────────────────────────────────────────────
 *
 * Non pas le stock, mais la **complétude de la cote** : le nombre
 * d'observations de prix dont on dispose sur ce modèle, vendues comprises.
 *
 * La distinction est tout le correctif. Une Peugeot 308 avec quarante ventes
 * passées et zéro annonce en ligne a une cote solide et un contenu substantiel ;
 * la page mérite l'index. Un modèle vu deux fois n'a pas de cote — la publier
 * reviendrait à présenter une moyenne sur deux points comme un prix de marché,
 * ce qui serait faux, et Google traite à juste titre ce genre de page en
 * contenu mince.
 *
 * On ne fabrique donc aucune donnée : à défaut d'observations, la page n'existe
 * pas (404). Avec des observations mais sans stock, elle existe, s'indexe, et
 * propose une alerte au lieu d'une grille vide.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { normalizeToken } from "@/lib/seo/city";

/**
 * Barre de qualité d'une page de cote. Aucune de ces valeurs ne parle de stock.
 */
export const PRICE_PAGE_QUALITY = {
  /**
   * Observations de prix nécessaires pour que la page existe.
   *
   * En dessous, il n'y a pas de cote — juste quelques prix isolés. La page
   * répond 404 plutôt que d'afficher une moyenne qui n'en est pas une.
   */
  minObservations: 5,
  /**
   * Observations nécessaires pour que la page **s'indexe**.
   *
   * Plus haut que le seuil d'existence : une page peut légitimement vivre pour
   * un visiteur venu d'un lien interne sans mériter d'être recommandée à
   * Google. C'est le pendant exact de la règle des pages ville × catégorie.
   */
  minIndexableObservations: 12,
  /** Longueur minimale du libellé — écarte « /prix/a-occasion ». */
  minQueryLength: 3,
} as const;

/** Le corpus d'observations : annonces publiées **et** vendues. */
const OBSERVATION_STATUSES = ["APPROVED", "SOLD"] as const;

export function priceQuery(slug: string): string {
  return slug.replace(/-occasion$/i, "").replace(/-/g, " ").trim();
}

export function priceTitle(slug: string): string {
  return priceQuery(slug)
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Slug canonique d'une page de cote, depuis une marque et un modèle. */
export function priceSlug(marque: string, modele: string): string {
  return `${normalizeToken(`${marque} ${modele}`)}-occasion`;
}

export type PriceQuote = {
  slug: string;
  query: string;
  title: string;
  /** Prix observés, annonces vendues comprises. C'est la matière de la cote. */
  observations: number;
  average: number;
  min: number;
  max: number;
  /** Annonces actuellement en ligne. N'entre dans **aucune** décision SEO. */
  activeCount: number;
};

/** Clause commune aux deux comptages. `mode: insensitive` sur les trois champs. */
function matchWhere(query: string, statuses: readonly string[]) {
  return {
    status: { in: [...statuses] },
    deletedAt: null,
    price: { gt: 0 },
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { brand: { contains: query, mode: "insensitive" } },
    ],
  } as any;
}

/**
 * Cote d'un slug, ou `null` s'il n'y a pas assez d'observations pour en parler.
 *
 * Deux requêtes : l'agrégat sur le corpus complet (la cote), et le comptage des
 * annonces en ligne (l'affichage). La seconde ne pèse sur aucune décision SEO —
 * elle sert uniquement à choisir entre la grille d'annonces et le module
 * d'alerte.
 */
export async function getPriceQuote(slug: string): Promise<PriceQuote | null> {
  const query = priceQuery(slug);
  if (query.length < PRICE_PAGE_QUALITY.minQueryLength) return null;

  const [agg, activeCount] = await Promise.all([
    prisma.listing
      .aggregate({
        where: matchWhere(query, OBSERVATION_STATUSES),
        _avg: { price: true },
        _min: { price: true },
        _max: { price: true },
        _count: { _all: true },
      })
      .catch(() => null),
    prisma.listing.count({ where: matchWhere(query, ["APPROVED"]) }).catch(() => 0),
  ]);

  if (!agg) return null;

  const observations = agg._count._all;
  if (observations < PRICE_PAGE_QUALITY.minObservations) return null;

  return {
    slug,
    query,
    title: priceTitle(slug),
    observations,
    average: Math.round(agg._avg.price ?? 0),
    min: Math.round(agg._min.price ?? 0),
    max: Math.round(agg._max.price ?? 0),
    activeCount,
  };
}

/**
 * La page mérite-t-elle l'index ?
 *
 * Une seule variable, et ce n'est pas `activeCount`. Écrit ainsi plutôt qu'en
 * ligne dans la page pour que la règle soit lisible d'un coup d'œil, et pour
 * que le sitemap ne puisse pas en appliquer une autre.
 */
export function isPriceQuoteIndexable(quote: PriceQuote | null): boolean {
  return !!quote && quote.observations >= PRICE_PAGE_QUALITY.minIndexableObservations;
}

/**
 * Pages de cote à annoncer au sitemap.
 *
 * L'espace `/prix/*` est ouvert : n'importe quel slug produit une page tant
 * qu'il a des observations. Le sitemap, lui, ne recommande que ce qui existe
 * réellement — donc on part des couples marque × modèle effectivement présents
 * en base, vendus compris, et on ne garde que ceux dont la cote est complète.
 *
 * Une seule lecture, tous les regroupements en mémoire : la version « une
 * agrégation par slug » coûtait une dizaine d'allers-retours base pour produire
 * un fichier XML.
 */
async function computeIndexablePriceSlugs(): Promise<string[]> {
  const rows = await prisma.listing
    .findMany({
      where: {
        status: { in: [...OBSERVATION_STATUSES] },
        deletedAt: null,
        price: { gt: 0 },
        category: "Véhicules",
      } as any,
      select: { metadata: true },
      take: 20_000,
    })
    .catch(() => null);

  // Panne base : aucune recommandation plutôt qu'une liste optimiste.
  if (!rows) return [];

  const counts = new Map<string, number>();
  for (const row of rows) {
    let marque: unknown;
    let modele: unknown;
    try {
      const meta = JSON.parse(row.metadata ?? "{}");
      marque = meta?.marque;
      modele = meta?.modele;
    } catch {
      continue;
    }
    if (typeof marque !== "string" || typeof modele !== "string") continue;
    if (!marque.trim() || !modele.trim()) continue;
    const slug = priceSlug(marque, modele);
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, n]) => n >= PRICE_PAGE_QUALITY.minIndexableObservations)
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => slug);
}

/**
 * Instantané des pages de cote indexables, aligné sur l'inventaire : même durée
 * de vie, même tag d'invalidation, donc jamais désynchronisé de lui.
 */
export const getIndexablePriceSlugs = unstable_cache(
  computeIndexablePriceSlugs,
  ["seo-price-slugs-v1"],
  { revalidate: 6 * 60 * 60, tags: ["listings"] },
);

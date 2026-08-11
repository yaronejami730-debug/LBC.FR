/**
 * Pages éditoriales à slug fixe : critères de rattachement et éligibilité.
 *
 * Ces pages (`/comparatif/*`, `/voiture/*`, `/voiture-budget/*`) refusent de
 * s'afficher quand le stock est trop maigre — un comparatif de deux modèles
 * dont aucun n'est en vente n'a rien à comparer. Elles appellent `notFound()`.
 *
 * Le sitemap, lui, recopiait la liste complète des slugs depuis
 * `lib/seo/static-routes.ts`, sans jamais vérifier le stock. Le crawl du 11/08
 * a mesuré la conséquence : **12 URL du sitemap répondaient 404**, dont
 * `/voiture/suv-occasion` et sept comparatifs sur onze. Annoncer une page morte
 * à Google est un signal de négligence sur tout le domaine.
 *
 * Les critères de rattachement vivent donc ici, en un seul exemplaire, lus à la
 * fois par les pages et par le sitemap. Les seuils sont exactement ceux que les
 * pages appliquaient déjà : rien ne change de ce qui s'affiche, seul le sitemap
 * cesse de mentir.
 *
 * Le contenu rédactionnel (intro, FAQ, libellés) reste dans les pages : il
 * n'intéresse pas le sitemap, et l'importer ici tirerait tout l'arbre de
 * composants dans le rendu du fichier XML.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/** Seuils de stock. Identiques à ceux codés dans les pages avant cette reprise. */
export const EDITORIAL_THRESHOLDS = {
  /** `/comparatif/[paire]` : somme des deux modèles. */
  comparatif: 6,
  /** `/voiture/[slug]` et `/voiture-budget/[tranche]`. */
  cluster: 3,
  budget: 3,
} as const;

export type ClusterKind = "fuel" | "body";

/** Critère de rattachement d'un cluster véhicule (carburant ou carrosserie). */
export type ClusterMatch = { slug: string; kind: ClusterKind; match: string[] };

export const VOITURE_CLUSTER_MATCH: ClusterMatch[] = [
  { slug: "electrique-occasion", kind: "fuel", match: ["Électrique", "Electrique", "Electric"] },
  { slug: "hybride-occasion", kind: "fuel", match: ["Hybride", "Hybrid", "Hybride rechargeable", "PHEV", "HEV"] },
  { slug: "diesel-occasion", kind: "fuel", match: ["Diesel", "Gazole"] },
  { slug: "essence-occasion", kind: "fuel", match: ["Essence", "Sans plomb", "SP95", "SP98"] },
  { slug: "suv-occasion", kind: "body", match: ["SUV", "Crossover", "4x4", "4X4"] },
  { slug: "berline-occasion", kind: "body", match: ["Berline", "Sedan"] },
  { slug: "citadine-occasion", kind: "body", match: ["Citadine", "Mini", "Petite"] },
  { slug: "break-occasion", kind: "body", match: ["Break", "Estate", "Touring", "Variant", "Avant", "SW"] },
];

export type BudgetMatch = { slug: string; min: number; max: number };

export const VOITURE_BUDGET_MATCH: BudgetMatch[] = [
  { slug: "moins-de-3000-euros", min: 1, max: 3000 },
  { slug: "moins-de-5000-euros", min: 1, max: 5000 },
  { slug: "moins-de-8000-euros", min: 1, max: 8000 },
  { slug: "moins-de-12000-euros", min: 1, max: 12000 },
  { slug: "moins-de-20000-euros", min: 1, max: 20000 },
];

export type PairMatch = {
  slug: string;
  a: { marque: string; modele: string };
  b: { marque: string; modele: string };
};

export const COMPARATIF_MATCH: PairMatch[] = [
  { slug: "peugeot-208-vs-renault-clio", a: { marque: "Peugeot", modele: "208" }, b: { marque: "Renault", modele: "Clio" } },
  { slug: "citroen-c3-vs-renault-clio", a: { marque: "Citroën", modele: "C3" }, b: { marque: "Renault", modele: "Clio" } },
  { slug: "peugeot-308-vs-renault-megane", a: { marque: "Peugeot", modele: "308" }, b: { marque: "Renault", modele: "Mégane" } },
  { slug: "volkswagen-golf-vs-peugeot-308", a: { marque: "Volkswagen", modele: "Golf" }, b: { marque: "Peugeot", modele: "308" } },
  { slug: "dacia-sandero-vs-renault-clio", a: { marque: "Dacia", modele: "Sandero" }, b: { marque: "Renault", modele: "Clio" } },
  { slug: "toyota-yaris-vs-renault-clio", a: { marque: "Toyota", modele: "Yaris" }, b: { marque: "Renault", modele: "Clio" } },
  { slug: "peugeot-3008-vs-renault-kadjar", a: { marque: "Peugeot", modele: "3008" }, b: { marque: "Renault", modele: "Kadjar" } },
  { slug: "bmw-serie-3-vs-audi-a4", a: { marque: "BMW", modele: "Série 3" }, b: { marque: "Audi", modele: "A4" } },
  { slug: "mercedes-classe-a-vs-bmw-serie-1", a: { marque: "Mercedes", modele: "Classe A" }, b: { marque: "BMW", modele: "Série 1" } },
  { slug: "audi-a3-vs-bmw-serie-1", a: { marque: "Audi", modele: "A3" }, b: { marque: "BMW", modele: "Série 1" } },
  { slug: "tesla-model-3-vs-peugeot-e-208", a: { marque: "Tesla", modele: "Model 3" }, b: { marque: "Peugeot", modele: "e-208" } },
];

/** Clause Prisma d'un cluster — la page l'utilise pour lister ses annonces. */
export function clusterWhere(cluster: ClusterMatch): Record<string, unknown> {
  const field = cluster.kind === "fuel" ? "carburant" : "typeVehicule";
  return {
    status: "APPROVED",
    deletedAt: null,
    shadowBanned: false,
    category: "Véhicules",
    price: { gt: 0 },
    OR: cluster.match.map((m) => ({
      metadata: { contains: `"${field}":"${m}"`, mode: "insensitive" },
    })),
  };
}

export function budgetWhere(budget: BudgetMatch): Record<string, unknown> {
  return {
    status: "APPROVED",
    deletedAt: null,
    shadowBanned: false,
    category: "Véhicules",
    price: { gte: budget.min, lte: budget.max },
  };
}

export function modelWhere(marque: string, modele: string): Record<string, unknown> {
  return {
    status: "APPROVED",
    deletedAt: null,
    shadowBanned: false,
    category: "Véhicules",
    price: { gt: 0 },
    AND: [
      { metadata: { contains: marque, mode: "insensitive" } },
      { metadata: { contains: modele, mode: "insensitive" } },
    ],
  };
}

export type EditorialEligibility = {
  comparatif: string[];
  clusters: string[];
  budgets: string[];
};

const EMPTY: EditorialEligibility = { comparatif: [], clusters: [], budgets: [] };

/**
 * Une seule lecture du stock véhicules, puis tous les comptages en mémoire.
 *
 * L'alternative — une requête d'agrégation par slug — coûtait 35 allers-retours
 * base pour produire un fichier XML. Sur 129 annonces véhicules, tout tient
 * largement en mémoire, et le calcul est instantané.
 */
async function computeEligibility(): Promise<EditorialEligibility> {
  const rows = await prisma.listing
    .findMany({
      where: {
        status: "APPROVED",
        deletedAt: null,
        shadowBanned: false,
        category: "Véhicules",
      } as any,
      select: { price: true, metadata: true },
      take: 20_000,
    })
    .catch(() => null);

  // Panne base : on renvoie une éligibilité vide plutôt qu'une liste optimiste.
  // Un sitemap temporairement plus court est sans conséquence ; un sitemap
  // rempli d'URL en 404 en a une.
  if (!rows) return EMPTY;

  const contains = (haystack: string | null, needle: string) =>
    (haystack ?? "").toLowerCase().includes(needle.toLowerCase());

  const clusters = VOITURE_CLUSTER_MATCH.filter((cluster) => {
    const field = cluster.kind === "fuel" ? "carburant" : "typeVehicule";
    const count = rows.filter(
      (r) =>
        (r.price ?? 0) > 0 &&
        cluster.match.some((m) => contains(r.metadata, `"${field}":"${m}"`)),
    ).length;
    return count >= EDITORIAL_THRESHOLDS.cluster;
  }).map((c) => c.slug);

  const budgets = VOITURE_BUDGET_MATCH.filter((budget) => {
    const count = rows.filter(
      (r) => (r.price ?? 0) >= budget.min && (r.price ?? 0) <= budget.max,
    ).length;
    return count >= EDITORIAL_THRESHOLDS.budget;
  }).map((b) => b.slug);

  const modelCount = (marque: string, modele: string) =>
    rows.filter(
      (r) =>
        (r.price ?? 0) > 0 && contains(r.metadata, marque) && contains(r.metadata, modele),
    ).length;

  const comparatif = COMPARATIF_MATCH.filter((pair) => {
    const total = modelCount(pair.a.marque, pair.a.modele) + modelCount(pair.b.marque, pair.b.modele);
    return total >= EDITORIAL_THRESHOLDS.comparatif;
  }).map((p) => p.slug);

  return { comparatif, clusters, budgets };
}

/**
 * Slugs éditoriaux qui répondront réellement 200 aujourd'hui.
 *
 * Mis en cache 6 h et invalidé par `revalidateTag("listings")`, comme
 * l'inventaire : les deux décrivent le même stock au même instant.
 */
export const getEditorialEligibility = unstable_cache(
  computeEligibility,
  ["seo-editorial-eligibility-v1"],
  { revalidate: 6 * 60 * 60, tags: ["listings"] },
);

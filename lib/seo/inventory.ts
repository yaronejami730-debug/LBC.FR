/**
 * Inventaire SEO — source unique de vérité sur « quelles pages méritent d'être
 * indexées ».
 *
 * Pourquoi ce fichier existe : le site génère des URL par catégorie × sous-
 * catégorie × ville × marque × modèle, soit plusieurs milliers de pages pour
 * quelques centaines d'annonces. Chaque page vide ou quasi vide que Google
 * explore dégrade la qualité perçue du domaine — et ralentit l'exploration des
 * pages qui, elles, ont de la valeur.
 *
 * Plutôt que de laisser chaque route poser sa propre requête de comptage (ce
 * qui avait fait exploser le quota compute fin juillet), on prend **un seul
 * instantané** de l'inventaire, mis en cache, et tout le monde lit dedans :
 * sitemap, `generateMetadata`, navigation.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { FRENCH_CITIES } from "@/lib/cities";
import { CAR_BRANDS } from "@/lib/carBrands";
import { subcategoryToSlug } from "@/lib/seo-content";
import { listingSlug } from "@/lib/listing-slug";
import { parseVehicleMeta } from "@/lib/vehicle-meta";

/**
 * Seuil d'indexation d'une page de liste.
 *
 * En dessous de 3 annonces, la page n'apporte rien à l'internaute : Google la
 * classe en contenu mince et le signal se propage au domaine. On sert quand
 * même la page (avec un état vide et un appel à publier) mais en
 * `noindex, follow` — les liens restent suivis, l'URL n'entre pas dans l'index.
 *
 * À relever le stock : une fois quelques milliers d'annonces en ligne, ce seuil
 * pourra redescendre à 1 sans risque.
 */
export const MIN_INDEXABLE_LISTINGS = 3;

/** Durée de vie de l'instantané. Assez long pour que les crawlers ne déclenchent
 *  jamais de recalcul en rafale, assez court pour rester frais à la journée. */
const SNAPSHOT_TTL_SECONDS = 6 * 60 * 60;

/** Garde-fou : au-delà, on arrête de charger. Le calcul reste en mémoire. */
const MAX_ROWS = 50_000;

export function slugifyValue(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type SeoListingEntry = {
  /** Chemin absolu depuis la racine, ex. `/annonce/abc123/audi-a3`. */
  path: string;
  lastModified: Date;
};

export type SeoInventory = {
  /** Dernière modification tous contenus confondus — sert de `lastmod` global. */
  lastModified: Date;
  /** Total d'annonces visibles. */
  total: number;
  listings: SeoListingEntry[];
  /** clé = id de catégorie */
  byCategory: Record<string, number>;
  /** clé = `${categorieId}/${sousCategorieSlug}` */
  byCategorySub: Record<string, number>;
  /** clé = `${categorieId}/${villeSlug}` */
  byCategoryCity: Record<string, number>;
  /** clé = `${categorieId}/${sousCategorieSlug}/${villeSlug}` */
  byCategorySubCity: Record<string, number>;
  /** clé = slug de ville */
  byCity: Record<string, number>;
  /** clé = slug de marque */
  byBrand: Record<string, number>;
  /** clé = `${marqueSlug}/${modeleSlug}` */
  byBrandModel: Record<string, number>;
};

const EMPTY_INVENTORY: SeoInventory = {
  lastModified: new Date(0),
  total: 0,
  listings: [],
  byCategory: {},
  byCategorySub: {},
  byCategoryCity: {},
  byCategorySubCity: {},
  byCity: {},
  byBrand: {},
  byBrandModel: {},
};

/** Index label de catégorie → id de route, construit une fois. */
const CATEGORY_ID_BY_LABEL = new Map(CATEGORIES.map((c) => [c.label, c.id]));

/** Villes du référentiel, pré-normalisées pour la comparaison. */
const CITY_MATCHERS = FRENCH_CITIES.map((c) => ({
  slug: c.slug,
  needle: c.name.toLowerCase(),
}));

/** Slugs de marques connues, pour écarter les valeurs libres saisies à la main. */
const BRAND_SLUGS = new Set(CAR_BRANDS.map((b) => slugifyValue(b.name)));

function bump(bucket: Record<string, number>, key: string) {
  bucket[key] = (bucket[key] ?? 0) + 1;
}

async function buildInventory(): Promise<SeoInventory> {
  const rows = await prisma.listing
    .findMany({
      where: {
        status: "APPROVED",
        shadowBanned: false,
        deletedAt: null,
      } as any,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        category: true,
        subcategory: true,
        location: true,
        metadata: true,
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_ROWS,
    })
    .catch(() => null);

  // Une panne base ne doit pas produire un sitemap vide : Next sert alors le
  // dernier rendu en cache, et à défaut un sitemap réduit aux pages statiques.
  if (!rows) return EMPTY_INVENTORY;

  const inv: SeoInventory = {
    lastModified: rows[0]?.updatedAt ?? new Date(),
    total: rows.length,
    listings: [],
    byCategory: {},
    byCategorySub: {},
    byCategoryCity: {},
    byCategorySubCity: {},
    byCity: {},
    byBrand: {},
    byBrandModel: {},
  };

  for (const row of rows) {
    inv.listings.push({
      path: `/annonce/${row.id}/${listingSlug(row.title)}`,
      lastModified: row.updatedAt,
    });

    const categoryId = CATEGORY_ID_BY_LABEL.get(row.category);
    const subSlug = row.subcategory ? subcategoryToSlug(row.subcategory) : null;
    const location = (row.location ?? "").toLowerCase();

    // Les routes ville filtrent sur `location contains <nom de ville>`. On
    // reproduit exactement ce test, sinon le sitemap annoncerait des pages que
    // la route rend vides.
    const cities = CITY_MATCHERS.filter((c) => location.includes(c.needle));

    for (const city of cities) bump(inv.byCity, city.slug);

    if (categoryId) {
      bump(inv.byCategory, categoryId);
      if (subSlug) bump(inv.byCategorySub, `${categoryId}/${subSlug}`);
      for (const city of cities) {
        bump(inv.byCategoryCity, `${categoryId}/${city.slug}`);
        if (subSlug) bump(inv.byCategorySubCity, `${categoryId}/${subSlug}/${city.slug}`);
      }
    }

    if (row.category !== "Véhicules") continue;

    // Comparaison sur le champ `marque` lui-même, jamais par sous-chaîne : la
    // marque « DS » se retrouvait sinon attribuée à toute annonce dont le JSON
    // contenait ces deux lettres.
    const { marque, modele } = parseVehicleMeta(row.metadata);
    if (!marque) continue;
    const brandSlug = slugifyValue(marque);
    if (!BRAND_SLUGS.has(brandSlug)) continue;

    bump(inv.byBrand, brandSlug);
    if (modele) bump(inv.byBrandModel, `${brandSlug}/${slugifyValue(modele)}`);
  }

  return inv;
}

/**
 * Instantané de l'inventaire, une requête toutes les 6 h.
 *
 * Le tag `listings` permet à une publication ou une modération de forcer le
 * recalcul via `revalidateTag("listings")`.
 */
export const getSeoInventory = unstable_cache(buildInventory, ["seo-inventory-v1"], {
  revalidate: SNAPSHOT_TTL_SECONDS,
  tags: ["listings"],
});

/** Une page de liste mérite-t-elle l'index ? */
export function isIndexable(count: number): boolean {
  return count >= MIN_INDEXABLE_LISTINGS;
}

/**
 * Directive `robots` pour une page de liste paginée.
 * Renvoie `undefined` quand la page est indexable — Next applique alors les
 * valeurs par défaut du layout.
 */
export function listingPageRobots(count: number, page = 1) {
  if (page > 1 || !isIndexable(count)) return { index: false, follow: true };
  return undefined;
}

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
 * sitemap, `generateMetadata`, navigation, file d'indexation.
 *
 * Deux corrections de fond par rapport à la version précédente :
 *
 *   1. Les annonces sont passées au juge d'indexabilité
 *      (`lib/seo/indexability.ts`) avant d'entrer dans l'inventaire. Avant,
 *      l'inventaire listait les 213 annonces publiées et le sitemap les
 *      annonçait toutes — alors que 160 d'entre elles répondaient `noindex`.
 *
 *   2. Le rattachement à une ville passe par `resolveCity()`
 *      (`lib/seo/city.ts`) et non plus par une recherche de sous-chaîne dans
 *      le champ `location`. L'ancienne règle attribuait « Vincennes » à la
 *      ville de Sens et ne reconnaissait aucune adresse écrite « 35000 Rennes ».
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { CAR_BRANDS } from "@/lib/carBrands";
import { subcategoryToSlug, slugToSubcategoryLabel } from "@/lib/seo-content";
import { listingSlug } from "@/lib/listing-slug";
import { parseVehicleMeta } from "@/lib/vehicle-meta";
import { resolveCity, normalizeToken } from "@/lib/seo/city";
import {
  evaluateListing,
  sitemapPriority,
  type ExclusionReason,
} from "@/lib/seo/indexability";
import { computeCityCategoryIndexability } from "@/lib/seo/city-category";

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

/** @deprecated Utiliser `normalizeToken` de `lib/seo/city.ts`. Conservé pour
 *  les appelants existants (routes marque/modèle). */
export function slugifyValue(value: string): string {
  return normalizeToken(value);
}

export type SeoListingEntry = {
  /** Chemin absolu depuis la racine, ex. `/annonce/abc123/audi-a3`. */
  path: string;
  lastModified: Date;
  /** Score SEO 0-100 issu du juge d'indexabilité. */
  score: number;
  /** `<priority>` du sitemap, dérivée du score. */
  priority: number;
};

/**
 * Fiche professionnelle publiée et vérifiée, telle que l'annuaire l'affiche.
 *
 * Le nom et la ville sont lus dans la même requête que le reste : l'annuaire
 * `/pro` en a besoin pour rendre un lien lisible, et une seconde requête sur
 * les mêmes lignes, six heures après l'instantané, aurait pu répondre autre
 * chose — un lien vers une fiche que l'inventaire ne connaît plus.
 */
export type SeoProEntry = SeoListingEntry & {
  name: string;
  city: string | null;
};

/** Annonce écartée de l'index, avec le motif — alimente le tableau de bord. */
export type SeoExcludedEntry = {
  id: string;
  path: string;
  score: number;
  reasons: ExclusionReason[];
};

export type SeoInventory = {
  /** Dernière modification tous contenus confondus — sert de `lastmod` global. */
  lastModified: Date;
  /** Total d'annonces publiées et visibles, indexables ou non. */
  total: number;
  /** Annonces qui passent la barre d'indexabilité. Seules celles-ci vont au sitemap. */
  listings: SeoListingEntry[];
  /** Annonces publiées mais écartées de l'index, avec leur motif. */
  excluded: SeoExcludedEntry[];
  /** Score moyen des annonces indexables, 0 si aucune. */
  averageScore: number;
  /** clé = id de catégorie */
  byCategory: Record<string, number>;
  /** clé = `${categorieId}/${sousCategorieSlug}` */
  byCategorySub: Record<string, number>;
  /** clé = `${categorieId}/${villeSlug}` */
  byCategoryCity: Record<string, number>;
  /** clé = `${categorieId}/${sousCategorieSlug}/${villeSlug}` */
  byCategorySubCity: Record<string, number>;
  /**
   * Verdict d'indexabilité des couples ville × catégorie, hystérésis appliquée.
   *
   * Couvre les clés de `byCategoryCity` **et** de `byCategorySubCity`. C'est la
   * seule table que consultent la balise `robots` de la page, le sitemap, la
   * file d'indexation et les émetteurs de liens — voir `lib/seo/city-category.ts`.
   *
   * Une clé absente vaut « non indexable » : un couple sans aucune annonce
   * indexable n'apparaît dans aucun compteur, et c'est précisément le cas qu'on
   * refuse d'exposer.
   */
  cityCategoryIndexable: Record<string, boolean>;
  /** clé = slug de ville */
  byCity: Record<string, number>;
  /** clé = slug de marque */
  byBrand: Record<string, number>;
  /** clé = `${marqueSlug}/${modeleSlug}` */
  byBrandModel: Record<string, number>;
  /** Fiches professionnelles publiées et vérifiées. */
  proProfiles: SeoProEntry[];
};

const EMPTY_INVENTORY: SeoInventory = {
  lastModified: new Date(0),
  total: 0,
  listings: [],
  excluded: [],
  averageScore: 0,
  byCategory: {},
  byCategorySub: {},
  byCategoryCity: {},
  byCategorySubCity: {},
  cityCategoryIndexable: {},
  byCity: {},
  byBrand: {},
  byBrandModel: {},
  proProfiles: [],
};

/** Index label de catégorie → id de route, construit une fois. */
const CATEGORY_ID_BY_LABEL = new Map(CATEGORIES.map((c) => [c.label, c.id]));

/** Slugs de marques connues, pour écarter les valeurs libres saisies à la main. */
const BRAND_SLUGS = new Set(CAR_BRANDS.map((b) => normalizeToken(b.name)));

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
        description: true,
        images: true,
        metadata: true,
        price: true,
        category: true,
        subcategory: true,
        location: true,
        condition: true,
        status: true,
        shadowBanned: true,
        deletedAt: true,
        qualityScore: true,
        reportCount: true,
        imageDupCount: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { isPro: true } },
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
    excluded: [],
    averageScore: 0,
    byCategory: {},
    byCategorySub: {},
    byCategoryCity: {},
    byCategorySubCity: {},
    cityCategoryIndexable: {},
    byCity: {},
    byBrand: {},
    byBrandModel: {},
    proProfiles: [],
  };

  let scoreSum = 0;

  for (const row of rows) {
    const verdict = evaluateListing({
      id: row.id,
      title: row.title,
      description: row.description,
      images: row.images,
      metadata: row.metadata,
      price: row.price,
      category: row.category,
      subcategory: row.subcategory,
      location: row.location,
      condition: row.condition,
      status: row.status,
      shadowBanned: row.shadowBanned,
      deletedAt: row.deletedAt,
      qualityScore: row.qualityScore,
      reportCount: row.reportCount,
      imageDupCount: row.imageDupCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      isPro: !!row.user?.isPro,
    });

    const path = `/annonce/${row.id}/${listingSlug(row.title)}`;

    if (!verdict.indexable) {
      inv.excluded.push({
        id: row.id,
        path,
        score: verdict.score,
        reasons: verdict.reasons,
      });
      // Une annonce non indexable n'alimente pas non plus les compteurs des
      // pages de liste : sinon une catégorie franchirait le seuil grâce à trois
      // annonces qui, individuellement, refusent l'index — et la page serait
      // indexée en promettant un contenu que Google a déjà écarté.
      continue;
    }

    scoreSum += verdict.score;
    inv.listings.push({
      path,
      lastModified: row.updatedAt,
      score: verdict.score,
      priority: sitemapPriority(verdict.score),
    });

    const categoryId = CATEGORY_ID_BY_LABEL.get(row.category);
    const citySlug = verdict.citySlug;

    /**
     * Sous-catégorie retenue seulement si elle existe vraiment au catalogue.
     *
     * `Listing.subcategory` est du texte libre venu du dépôt et des imports :
     * on y trouve « Voiture d'occasion », « Voitures d'occasion », « Voiture
     * particulière », « Automobile »… là où la taxonomie ne connaît que
     * « Voiture ». Le sitemap annonçait ces variantes, la page les refusait :
     * neuf URL en 404 offertes à Google, et une de plus à chaque orthographe
     * inventée. On ne publie donc que ce que la route sait résoudre.
     */
    const rawSubSlug = row.subcategory ? subcategoryToSlug(row.subcategory) : null;
    const subSlug =
      categoryId && rawSubSlug && slugToSubcategoryLabel(categoryId, rawSubSlug)
        ? rawSubSlug
        : null;

    if (citySlug) bump(inv.byCity, citySlug);

    if (categoryId) {
      bump(inv.byCategory, categoryId);
      if (subSlug) bump(inv.byCategorySub, `${categoryId}/${subSlug}`);
      if (citySlug) {
        bump(inv.byCategoryCity, `${categoryId}/${citySlug}`);
        if (subSlug) bump(inv.byCategorySubCity, `${categoryId}/${subSlug}/${citySlug}`);
      }
    }

    if (row.category !== "Véhicules") continue;

    // Comparaison sur le champ `marque` lui-même, jamais par sous-chaîne : la
    // marque « DS » se retrouvait sinon attribuée à toute annonce dont le JSON
    // contenait ces deux lettres.
    const { marque, modele } = parseVehicleMeta(row.metadata);
    if (!marque) continue;
    const brandSlug = normalizeToken(marque);
    if (!BRAND_SLUGS.has(brandSlug)) continue;

    bump(inv.byBrand, brandSlug);
    if (modele) bump(inv.byBrandModel, `${brandSlug}/${normalizeToken(modele)}`);
  }

  inv.averageScore = inv.listings.length
    ? Math.round(scoreSum / inv.listings.length)
    : 0;

  // ── Ville × catégorie : verdict avec hystérésis ───────────────────────────
  //
  // L'état précédent vit dans `SeoUrl`, écrit par la synchro de la file. Une
  // seule requête, sur des lignes déjà indexées par `type` — et le résultat est
  // figé pour les 6 h de vie de l'instantané.
  //
  // En cas de panne, la carte reste vide : tous les couples repassent alors par
  // le seuil d'entrée, le plus strict des deux. Un couple légitime peut ainsi
  // perdre son indexabilité une journée, ce qui est sans commune mesure avec le
  // risque inverse — republier mille pages vides dans le sitemap.
  const previousVerdicts = await prisma.seoUrl
    .findMany({
      where: { type: "CATEGORY_CITY" },
      select: { path: true, indexable: true },
      take: MAX_ROWS,
    })
    .catch(() => [] as Array<{ path: string; indexable: boolean }>);

  const previous: Record<string, boolean> = {};
  for (const row of previousVerdicts) {
    if (!row.path.startsWith("/annonces/")) continue;
    previous[row.path.slice("/annonces/".length)] = row.indexable;
  }

  inv.cityCategoryIndexable = computeCityCategoryIndexability(
    { ...inv.byCategoryCity, ...inv.byCategorySubCity },
    previous,
  );

  // ── Fiches professionnelles ───────────────────────────────────────────────
  //
  // Ce sont les meilleures pages du site pour la recherche locale et pour les
  // moteurs génératifs : une adresse réelle, des horaires, une carte de
  // prestations tarifées, un SIRET contrôlé. Elles portaient déjà leurs données
  // structurées LocalBusiness, mais n'étaient annoncées nulle part — donc
  // découvertes uniquement par maillage interne, ou pas du tout.
  //
  // Condition d'entrée : profil publié **et** habilitation professionnelle
  // accordée. Une fiche non vérifiée n'est pas une source fiable, et la
  // présenter comme telle à Google se retournerait contre le domaine.
  const pros = await prisma.proProfile
    .findMany({
      where: {
        isPublished: true,
        user: { professionalStatus: "APPROVED", bannedAt: null },
      },
      select: { slug: true, name: true, city: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5_000,
    })
    .catch(() => []);

  for (const pro of pros) {
    inv.proProfiles.push({
      path: `/pro/${pro.slug}`,
      name: pro.name,
      city: pro.city,
      lastModified: pro.updatedAt,
      // Une fiche vérifiée est une page de référence : adresse réelle, SIRET
      // contrôlé, contenu stable. Elle passe devant les annonces, qui vivent
      // quelques semaines.
      score: 85,
      priority: 0.8,
    });
  }

  return inv;
}

/**
 * Instantané de l'inventaire, une requête toutes les 6 h.
 *
 * Le tag `listings` permet à une publication ou une modération de forcer le
 * recalcul via `revalidateTag("listings")`.
 */
export const getSeoInventory = unstable_cache(buildInventory, ["seo-inventory-v3"], {
  revalidate: SNAPSHOT_TTL_SECONDS,
  tags: ["listings"],
});

/**
 * Une sous-catégorie a-t-elle de quoi être liée ?
 *
 * `/annonces/{categorie}/{sous-categorie}` répond **404** à stock nul — décision
 * assumée dans `app/annonces/[categorie]/[...slug]/page.tsx` : ces pages ne sont
 * pas des pages sous leur seuil, ce sont des pages sans contenu, et le 404 est
 * la seule réponse que Google traite comme un ordre de retrait.
 *
 * La contrepartie, c'est qu'aucun lien du site ne doit y mener. Le crawl du
 * 23/08/2026 en a trouvé trois — `/annonces/maison/bricolage`,
 * `/annonces/maison/electromenager`, `/annonces/maison/jardinage` — liées
 * depuis les puces de la page catégorie, qui affichait la taxonomie entière
 * sans regarder le stock. Un lien interne vers une 404 dépense du budget
 * d'exploration et fait passer le site pour mal tenu ; c'est aussi, pour un
 * visiteur, un cul-de-sac.
 *
 * Le seuil est **une** annonce indexable, pas trois : il ne s'agit pas de
 * décider si la page mérite l'index — elle porte déjà sa propre balise — mais
 * seulement si elle existe. Un compteur d'inventaire non nul garantit au moins
 * une annonce publiée, donc une page qui répond 200.
 */
export function subcategoryHasStock(
  inv: Pick<SeoInventory, "byCategorySub">,
  categoryId: string,
  subSlug: string,
): boolean {
  return (inv.byCategorySub[`${categoryId}/${subSlug}`] ?? 0) > 0;
}

/**
 * Une marque a-t-elle de quoi être liée ?
 *
 * Même distinction que `subcategoryHasStock`, et pour la même raison :
 * **exister** et **mériter l'index** sont deux questions différentes.
 * `/annonces/vehicules/{marque}` ne renvoie 404 qu'à stock strictement nul
 * (`app/annonces/vehicules/[marque]/page.tsx`) ; entre une et deux annonces,
 * elle répond 200 avec sa propre balise `noindex, follow`.
 *
 * L'unique émetteur de liens marque filtrait pourtant sur `isIndexable`,
 * c'est-à-dire trois annonces. Conséquence mesurée au crawl du 28/08 : Ford,
 * Land Rover et Volvo — trois marques du référentiel, avec du stock, servies
 * en 200 — n'étaient citées nulle part sur le site. Une page qu'aucun lien
 * n'atteint n'est pas explorée, donc les annonces qu'elle porte ne le sont pas
 * non plus par ce chemin.
 *
 * Pourquoi le seuil de trois est le bon pour les villes et le mauvais ici :
 * l'espace ville × catégorie compte 12 555 URL pour quelques centaines
 * d'annonces, et couper les liens y est le seul frein au gaspillage de budget
 * d'exploration. L'espace marque est borné par `lib/carBrands.ts` — une
 * quarantaine d'entrées, dont seules celles qui ont du stock passent ce test.
 * Lier une marque à une annonce coûte un lien ; ne pas la lier coûte une page.
 *
 * Le compteur lu est celui des annonces **indexables**, plus strict que le
 * comptage brut de la page : un compteur non nul garantit donc une page en 200,
 * jamais l'inverse. C'est le sens d'erreur sûr.
 *
 * ⚠️ Second émetteur à migrer : le bloc « Voitures d'occasion par marque » de
 * `app/annonces/[categorie]/page.tsx` filtre encore sur `isIndexable`. Il
 * n'émet donc qu'un sous-ensemble de ce que ce juge autorise — aucun lien mort,
 * mais deux règles pour une même famille d'URL, ce que ce dépôt refuse par
 * ailleurs. Remplacer `isIndexable(count)` par `brandHasStock(inv, slug)`.
 */
export function brandHasStock(
  inv: Pick<SeoInventory, "byBrand">,
  brandSlug: string,
): boolean {
  return (inv.byBrand[brandSlug] ?? 0) > 0;
}

/** Une page de liste mérite-t-elle l'index ? */
export function isIndexable(count: number): boolean {
  return count >= MIN_INDEXABLE_LISTINGS;
}

/**
 * Directive `robots` pour une page de liste paginée.
 *
 * Au-delà de la page 1 : `noindex, follow`. La pagination ne porte aucune
 * intention de recherche propre — personne ne cherche « page 3 des voitures » —
 * mais ses liens doivent rester suivis pour que Googlebot atteigne les annonces
 * qu'elle contient.
 *
 * Renvoie `undefined` quand la page est indexable : Next applique alors les
 * valeurs par défaut du layout.
 */
export function listingPageRobots(count: number, page = 1) {
  if (page > 1 || !isIndexable(count)) return { index: false, follow: true };
  return undefined;
}

/**
 * URL canonique d'une page de liste paginée.
 *
 * Auto-référente, y compris en page 2 et au-delà. Faire pointer la page 2 vers
 * la page 1 tout en la marquant `noindex` envoie deux ordres contradictoires :
 * « ignore cette page » et « attribue-la à cette autre page ». Google demande
 * explicitement de ne pas combiner les deux.
 */
export function paginatedCanonical(baseUrl: string, page: number): string {
  return page > 1 ? `${baseUrl}?page=${page}` : baseUrl;
}

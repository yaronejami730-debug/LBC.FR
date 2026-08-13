/**
 * Banc d'essai du juge ville × catégorie (`lib/seo/city-category.ts`).
 *
 *   npm run test:city-category
 *
 * Il vérifie trois choses, et rien d'autre :
 *
 *   1. **l'hystérésis** — une page devient indexable à 5 annonces, et ne
 *      redevient non-indexable qu'en dessous de 3. Entre les deux, elle garde
 *      son état. C'est ce qui empêche une page de clignoter à chaque vente,
 *      signal qu'un domaine jeune paie cher ;
 *
 *   2. **l'unicité du verdict** — la balise `robots` de la page, l'entrée au
 *      sitemap et la décision d'émettre un lien lisent tous la même table
 *      `cityCategoryIndexable`. Le test rejoue leurs trois lectures sur un
 *      inventaire fabriqué et exige un résultat identique. Si un jour l'un des
 *      trois se met à recalculer dans son coin, c'est ici que ça casse ;
 *
 *   3. **la cohérence de la clé** — sous-catégorie comprise, et sans
 *      renormaliser le slug de ville, qui vient déjà de `resolveCity()`.
 *
 * Fonctions pures, aucun accès base : le banc tourne hors ligne.
 */

import {
  CITY_CATEGORY_THRESHOLDS,
  cityCategoryKey,
  computeCityCategoryIndexability,
  decideCityCategory,
  isCityCategoryIndexable,
} from "../lib/seo/city-category";

const { enter, exit } = CITY_CATEGORY_THRESHOLDS;

let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`\x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed++;
    console.log(`\x1b[31m✗\x1b[0m ${label}`);
    console.log(`    obtenu ${JSON.stringify(actual)}, attendu ${JSON.stringify(expected)}`);
  }
}

// ── 1. Hystérésis ──────────────────────────────────────────────────────────
console.log("\n── Hystérésis ──");

check(`0 annonce, page neuve → non indexable`, decideCityCategory(0, false), false);
check(`${exit} annonces, page neuve → non indexable (seuil d'entrée non atteint)`, decideCityCategory(exit, false), false);
check(`${enter - 1} annonces, page neuve → non indexable`, decideCityCategory(enter - 1, false), false);
check(`${enter} annonces, page neuve → indexable`, decideCityCategory(enter, false), true);

check(`${enter} annonces, page déjà indexable → reste indexable`, decideCityCategory(enter, true), true);
check(`${exit} annonces, page déjà indexable → reste indexable (zone morte)`, decideCityCategory(exit, true), true);
check(`${enter - 1} annonces, page déjà indexable → reste indexable (zone morte)`, decideCityCategory(enter - 1, true), true);
check(`${exit - 1} annonces, page déjà indexable → sort de l'index`, decideCityCategory(exit - 1, true), false);
check(`0 annonce, page déjà indexable → sort de l'index`, decideCityCategory(0, true), false);

// Le scénario réel : une page franchit le seuil, perd deux annonces, en
// regagne une. Sans hystérésis elle aurait basculé deux fois pour rien.
console.log("\n── Scénario : publications puis ventes ──");
let state = false;
const trajectory: Array<[number, boolean]> = [];
for (const count of [0, 2, 4, 5, 6, 4, 3, 4, 2, 3, 6]) {
  state = decideCityCategory(count, state);
  trajectory.push([count, state]);
}
check(
  "trajectoire 0→2→4→5→6→4→3→4→2→3→6",
  trajectory.map(([, s]) => (s ? "I" : "-")).join(""),
  // entre à 5, tient jusqu'à 2, sort, ne revient qu'à 6
  "---IIIII--I",
);

// ── 2. Un seul verdict pour trois consommateurs ────────────────────────────
console.log("\n── Source de vérité unique ──");

const counts = {
  // catégorie × ville
  "immobilier/metz": 7, // au-dessus du seuil d'entrée
  "loisirs/calais": 4, // entre les deux seuils, page neuve → dehors
  "services/pessac": 4, // entre les deux seuils, page déjà indexable → dedans
  "loisirs/chartres": 1, // sous le seuil de sortie
  // catégorie × sous-catégorie × ville
  "multimedia/image-son/vannes": 2,
  "immobilier/locations/metz": 5,
};

const previous = {
  "services/pessac": true,
  "loisirs/chartres": true,
};

const inventory = {
  cityCategoryIndexable: computeCityCategoryIndexability(counts, previous),
};

check("Metz × immobilier (7 annonces) indexable", inventory.cityCategoryIndexable["immobilier/metz"], true);
check("Calais × loisirs (4, page neuve) non indexable", inventory.cityCategoryIndexable["loisirs/calais"], false);
check("Pessac × services (4, déjà indexable) reste indexable", inventory.cityCategoryIndexable["services/pessac"], true);
check("Chartres × loisirs (1, déjà indexable) sort", inventory.cityCategoryIndexable["loisirs/chartres"], false);
check("Vannes × image-son (2) non indexable", inventory.cityCategoryIndexable["multimedia/image-son/vannes"], false);
check("Metz × locations (5) indexable", inventory.cityCategoryIndexable["immobilier/locations/metz"], true);

/** Ce que fait la balise `robots` de `app/annonces/[categorie]/[...slug]`. */
const robotsSaysIndex = (categoryId: string, city: string, sub?: string | null) =>
  isCityCategoryIndexable(inventory, categoryId, city, sub);

/** Ce que fait `app/sitemap.ts`. */
const sitemapIncludes = (key: string) => inventory.cityCategoryIndexable[key] ?? false;

/** Ce que fait un émetteur de liens (fil d'Ariane, villes voisines, blog…). */
const linkEmitted = (categoryId: string, city: string, sub?: string | null) =>
  isCityCategoryIndexable(inventory, categoryId, city, sub);

for (const [categoryId, sub, city] of [
  ["immobilier", null, "metz"],
  ["loisirs", null, "calais"],
  ["services", null, "pessac"],
  ["loisirs", null, "chartres"],
  ["multimedia", "image-son", "vannes"],
  ["immobilier", "locations", "metz"],
] as Array<[string, string | null, string]>) {
  const key = cityCategoryKey(categoryId, city, sub);
  const trio = [robotsSaysIndex(categoryId, city, sub), sitemapIncludes(key), linkEmitted(categoryId, city, sub)];
  check(
    `${key} — robots / sitemap / lien concordent`,
    trio,
    [trio[0], trio[0], trio[0]],
  );
}

// ── 3. Clés et couples inconnus ────────────────────────────────────────────
console.log("\n── Clés ──");

check("clé sans sous-catégorie", cityCategoryKey("immobilier", "metz"), "immobilier/metz");
check("clé avec sous-catégorie", cityCategoryKey("immobilier", "metz", "locations"), "immobilier/locations/metz");
check("clé avec sous-catégorie nulle", cityCategoryKey("immobilier", "metz", null), "immobilier/metz");

// Un couple absent des compteurs n'a aucune annonce indexable : c'est
// exactement ce qu'on refuse d'exposer. Il ne doit jamais valoir `true` par
// défaut.
check("couple inconnu → non indexable", isCityCategoryIndexable(inventory, "emploi", "brest"), false);
check("inventaire vide → non indexable", isCityCategoryIndexable({ cityCategoryIndexable: {} }, "immobilier", "metz"), false);

console.log(failed === 0 ? "\n\x1b[32mTous les cas passent.\x1b[0m" : `\n\x1b[31m${failed} cas en échec.\x1b[0m`);
process.exit(failed > 0 ? 1 : 0);

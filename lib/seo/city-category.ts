/**
 * Juge unique des pages ville × catégorie.
 *
 * ── Pourquoi ce fichier existe ────────────────────────────────────────────
 *
 * Le site sait produire `/annonces/{categorie}/{ville}` pour n'importe quel
 * couple : 12 catégories × 157 communes du référentiel, plus la déclinaison
 * par sous-catégorie. La matrice complète dépasse le millier d'URL, pour un
 * stock de quelques centaines d'annonces. La quasi-totalité de ces pages est
 * donc vide.
 *
 * Elles portaient déjà `noindex` — décision correcte, et elle a fonctionné :
 * Search Console en comptait 1 586 au 12/08/2026, toutes proprement exclues de
 * l'index. Le problème est ailleurs. **Le `noindex` empêche l'indexation, pas
 * l'exploration.** Ces pages restaient liées depuis le pied de page, les blocs
 * « villes voisines », les fils d'Ariane et les sélecteurs de ville, donc
 * Googlebot continuait de les demander une par une — pendant que 234 URL
 * utiles étaient « détectées, actuellement non indexées », c'est-à-dire
 * trouvées et jamais explorées faute de budget.
 *
 * Et la masse croît toute seule : +240 en trois mois, proportionnellement à
 * l'inventaire. Mieux baliser n'y change rien. La seule correction qui tienne
 * est de **ne pas exposer** ces pages.
 *
 * ── Ce que ce module garantit ─────────────────────────────────────────────
 *
 * Une seule fonction tranche — `isCityCategoryIndexable()` — et trois familles
 * de consommateurs l'appellent, sans exception :
 *
 *   1. la balise `robots` de `app/annonces/[categorie]/[...slug]` ;
 *   2. le sitemap et la file d'indexation ;
 *   3. **tous** les émetteurs de liens internes.
 *
 * Le troisième point est le levier réel. Les deux premiers ne font que cesser
 * de recommander ; c'est la coupe des liens entrants qui fait qu'un crawler
 * arrête progressivement de venir.
 *
 * ── Hystérésis ───────────────────────────────────────────────────────────
 *
 * Une page qui bascule indexable → non-indexable → indexable à chaque vente
 * envoie un signal contradictoire, et un domaine jeune le paie cher. D'où deux
 * seuils au lieu d'un : il en faut cinq pour entrer, il en faut moins de trois
 * pour sortir. Entre les deux, la page garde l'état qu'elle avait.
 *
 * L'état précédent est lu dans la table `SeoUrl`, alimentée par la synchro de
 * la file (`lib/seo/queue.ts`). En son absence — première exécution, panne
 * base — on retombe sur le seuil d'entrée, c'est-à-dire le plus strict : mieux
 * vaut ne pas exposer une page qui l'aurait mérité que d'exposer mille pages
 * vides.
 */

import type { SeoInventory } from "@/lib/seo/inventory";

/**
 * Seuils d'indexation d'un couple ville × catégorie, en annonces **indexables**
 * (l'inventaire n'y compte pas les annonces que le juge d'annonce a déjà
 * écartées — voir `lib/seo/inventory.ts`).
 *
 * Nommés et exportés plutôt qu'écrits en dur : ils sont destinés à bouger avec
 * le stock, et le test de non-régression les lit ici.
 */
export const CITY_CATEGORY_THRESHOLDS = {
  /** Il en faut au moins autant pour qu'une page **devienne** indexable. */
  enter: 5,
  /** En dessous de ce seuil, une page indexable **redevient** non-indexable. */
  exit: 3,
} as const;

/**
 * Décision brute, avec hystérésis. Fonction pure, sans accès base : c'est elle
 * que le test de non-régression exerce.
 *
 * @param count        annonces indexables sur ce couple
 * @param wasIndexable état précédent connu, `false` si inconnu
 */
export function decideCityCategory(count: number, wasIndexable: boolean): boolean {
  return wasIndexable
    ? count >= CITY_CATEGORY_THRESHOLDS.exit
    : count >= CITY_CATEGORY_THRESHOLDS.enter;
}

/**
 * Clé d'un couple, identique à celle des compteurs de l'inventaire.
 *
 * Le slug de ville attendu est **celui du référentiel**, tel que produit par
 * `resolveCity()` (`lib/seo/city.ts`) : c'est lui qui a alimenté les
 * compteurs. Aucune normalisation n'est refaite ici — il n'y en a qu'une sur
 * le site, et elle vit dans `city.ts`.
 */
export function cityCategoryKey(
  categoryId: string,
  citySlug: string,
  subcategorySlug?: string | null,
): string {
  return subcategorySlug
    ? `${categoryId}/${subcategorySlug}/${citySlug}`
    : `${categoryId}/${citySlug}`;
}

/**
 * La page ville × catégorie mérite-t-elle d'être indexée — et donc liée ?
 *
 * Unique point d'entrée pour les appelants. Le verdict est précalculé une fois
 * par instantané d'inventaire (`cityCategoryIndexable`), donc l'appel ne coûte
 * rien et ne peut pas diverger d'un consommateur à l'autre : ils lisent tous
 * la même table.
 */
export function isCityCategoryIndexable(
  inventory: Pick<SeoInventory, "cityCategoryIndexable">,
  categoryId: string,
  citySlug: string,
  subcategorySlug?: string | null,
): boolean {
  return (
    inventory.cityCategoryIndexable[
      cityCategoryKey(categoryId, citySlug, subcategorySlug)
    ] ?? false
  );
}

/**
 * Applique l'hystérésis à tous les compteurs ville × catégorie d'un instantané.
 *
 * Appelée une seule fois, à la construction de l'inventaire.
 *
 * @param counts   compteurs `byCategoryCity` **et** `byCategorySubCity` fusionnés
 * @param previous verdicts précédents, par la même clé
 */
export function computeCityCategoryIndexability(
  counts: Record<string, number>,
  previous: Record<string, boolean>,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [key, count] of Object.entries(counts)) {
    out[key] = decideCityCategory(count, previous[key] ?? false);
  }
  return out;
}

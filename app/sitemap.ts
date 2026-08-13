/**
 * Sitemap — un seul fichier, une seule requête base.
 *
 * Historique : la version précédente (468 lignes, `groupBy` + `aggregate` +
 * `findMany` de 5 000 lignes de metadata, découpage prévu pour 100 000
 * annonces) faisait exploser le quota compute à chaque passage de crawler. Elle
 * a été supprimée en urgence le 29/07 — et le site s'est retrouvé sans sitemap
 * pendant que `robots.txt` continuait de l'annoncer, donc en 404 pour Google.
 *
 * Cette version repose entièrement sur `getSeoInventory()` : un instantané
 * unique, mis en cache 6 h, partagé avec les pages. Un crawler qui martèle
 * `/sitemap.xml` ne déclenche aucune requête supplémentaire.
 *
 * ── Règle unique, sans exception ──────────────────────────────────────────
 *
 * **Une URL n'entre ici que si elle répond 200 et s'indexe.** Le crawl du
 * 11/08 avait mesuré l'inverse : sur 362 URL annoncées, 28 renvoyaient 404 et
 * 161 répondaient `noindex`. Un sitemap n'est pas un inventaire du site, c'est
 * une liste de recommandations. Y placer une page qui refuse l'index revient à
 * demander à Google d'ignorer nos propres recommandations — et il en tient
 * compte pour tout le domaine.
 *
 * Les trois filtres correspondants :
 *   - annonces  → juge d'indexabilité (`lib/seo/indexability.ts`)
 *   - listes    → seuil de stock (`isIndexable`)
 *   - éditorial → éligibilité réelle (`lib/seo/editorial.ts`), car ces pages
 *                 appellent `notFound()` sous leur seuil
 *
 * `lastmod` ne porte que des dates réelles. Un `lastmod` fabriqué — la date du
 * jour recopiée sur 91 URL, comme c'était le cas — n'accélère rien : Google
 * apprend simplement à ne plus faire confiance au champ.
 */

import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { FRENCH_CITIES } from "@/lib/cities";
import { getAllArticles } from "@/lib/blog";
import { getSeoInventory, isIndexable } from "@/lib/seo/inventory";
import { getEditorialEligibility } from "@/lib/seo/editorial";
import { getIndexablePriceSlugs } from "@/lib/seo/price";
import { STATIC_PAGES } from "@/lib/seo/static-routes";

const BASE = "https://www.dealandcompany.fr";

/** Le rendu lui-même est mis en cache 6 h, en plus de l'instantané. */
export const revalidate = 21600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [inv, editorial, priceSlugs] = await Promise.all([
    getSeoInventory(),
    getEditorialEligibility(),
    getIndexablePriceSlugs(),
  ]);

  const now = new Date();
  /**
   * `lastmod` des pages de liste : la dernière modification d'annonce connue.
   * C'est une date vraie — une page de catégorie change effectivement quand une
   * annonce de cette catégorie change. À défaut de stock, on n'invente rien.
   */
  const stockLastMod = inv.total > 0 ? inv.lastModified : now;

  const entries: MetadataRoute.Sitemap = [];

  // --- Pages permanentes -------------------------------------------------
  //
  // Pas de `lastmod` : ces pages ne changent qu'à l'occasion d'un déploiement,
  // et prétendre le contraire chaque jour est précisément l'abus que Google
  // pénalise en ignorant le champ.
  for (const page of STATIC_PAGES) {
    entries.push({
      url: page.path === "/" ? BASE : `${BASE}${page.path}`,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    });
  }

  // --- Blog : le seul actif qui performe aujourd'hui, priorité haute ------
  for (const article of getAllArticles()) {
    entries.push({
      url: `${BASE}/blog/${article.slug}`,
      lastModified: new Date(article.updatedAt),
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  // --- Pages éditoriales : uniquement celles qui ont le stock pour s'afficher
  for (const slug of editorial.comparatif) {
    entries.push({
      url: `${BASE}/comparatif/${slug}`,
      lastModified: stockLastMod,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }
  for (const slug of editorial.clusters) {
    entries.push({
      url: `${BASE}/voiture/${slug}`,
      lastModified: stockLastMod,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }
  for (const slug of editorial.budgets) {
    entries.push({
      url: `${BASE}/voiture-budget/${slug}`,
      lastModified: stockLastMod,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // --- Pages de cote : indexées sur la solidité de la cote, pas sur le stock
  //
  // Elles n'étaient annoncées nulle part, et la page posait `noindex` sous
  // trois annonces actives. `/prix/peugeot-308-occasion` — requête à volume
  // réel — était donc exclue de l'index pour une raison sans rapport avec sa
  // capacité à répondre. Le critère est désormais le nombre d'observations de
  // prix, annonces vendues comprises : voir `lib/seo/price.ts`.
  //
  // `changeFrequency: monthly` est délibéré : une cote bouge lentement, et
  // réclamer un passage quotidien sur une page stable est exactement ce qui
  // consomme le budget d'exploration ailleurs.
  for (const slug of priceSlugs) {
    entries.push({
      url: `${BASE}/prix/${slug}`,
      lastModified: stockLastMod,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  // --- Listes : uniquement celles qui passent le seuil d'indexation -------
  for (const cat of CATEGORIES) {
    if (!isIndexable(inv.byCategory[cat.id] ?? 0)) continue;
    entries.push({
      url: `${BASE}/annonces/${cat.id}`,
      lastModified: stockLastMod,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  for (const [key, count] of Object.entries(inv.byCategorySub)) {
    if (!isIndexable(count)) continue;
    entries.push({
      url: `${BASE}/annonces/${key}`,
      lastModified: stockLastMod,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  // Catégorie × ville et catégorie × sous-catégorie × ville.
  //
  // Sous `vehicules`, ces URL sont interceptées par le dossier statique des
  // marques (`app/annonces/vehicules/[marque]`) : elles renvoyaient 404 malgré
  // leur présence ici. Les routes marque délèguent désormais à la page
  // générique dès que le segment est une ville connue, donc ces URL répondent
  // 200 et retrouvent leur place au sitemap.
  //
  // Le seuil n'est pas `isIndexable` mais le juge dédié
  // (`lib/seo/city-category.ts`), plus haut et à hystérésis : c'est cette
  // famille qui produisait à elle seule les 1 586 URL en `noindex` de Search
  // Console, et il n'y a qu'un seul verdict — celui-ci — pour le sitemap, la
  // balise `robots` de la page et les liens internes.
  for (const key of Object.keys(inv.byCategoryCity)) {
    if (!inv.cityCategoryIndexable[key]) continue;
    entries.push({
      url: `${BASE}/annonces/${key}`,
      lastModified: stockLastMod,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  for (const key of Object.keys(inv.byCategorySubCity)) {
    if (!inv.cityCategoryIndexable[key]) continue;
    entries.push({
      url: `${BASE}/annonces/${key}`,
      lastModified: stockLastMod,
      changeFrequency: "daily",
      priority: 0.6,
    });
  }

  const cityBySlug = new Map(FRENCH_CITIES.map((c) => [c.slug, c]));
  for (const [slug, count] of Object.entries(inv.byCity)) {
    if (!isIndexable(count) || !cityBySlug.has(slug)) continue;
    entries.push({
      url: `${BASE}/ville/${slug}`,
      lastModified: stockLastMod,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  for (const [slug, count] of Object.entries(inv.byBrand)) {
    if (!isIndexable(count)) continue;
    entries.push({
      url: `${BASE}/annonces/vehicules/${slug}`,
      lastModified: stockLastMod,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  for (const [key, count] of Object.entries(inv.byBrandModel)) {
    if (!isIndexable(count)) continue;
    entries.push({
      url: `${BASE}/annonces/vehicules/${key}`,
      lastModified: stockLastMod,
      changeFrequency: "daily",
      priority: 0.6,
    });
  }

  // --- Fiches professionnelles ---------------------------------------------
  //
  // Priorité haute, et volontairement au-dessus des annonces : une fiche pro
  // est stable dans le temps, adossée à un SIRET vérifié et à une adresse
  // réelle, là où une annonce disparaît en quelques semaines.
  for (const pro of inv.proProfiles) {
    entries.push({
      url: `${BASE}${pro.path}`,
      lastModified: pro.lastModified,
      changeFrequency: "weekly",
      priority: pro.priority,
    });
  }

  // --- Annonces indexables --------------------------------------------------
  //
  // `inv.listings` ne contient que celles qui passent le juge d'indexabilité :
  // les autres sont dans `inv.excluded` et n'ont rien à faire ici.
  for (const listing of inv.listings) {
    entries.push({
      url: `${BASE}${listing.path}`,
      lastModified: listing.lastModified,
      changeFrequency: "weekly",
      priority: listing.priority,
    });
  }

  return entries;
}

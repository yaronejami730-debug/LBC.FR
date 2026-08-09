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
 * Règle d'inclusion : **seules les URL réellement indexables entrent ici.** Une
 * page de liste sous le seuil `MIN_INDEXABLE_LISTINGS` est en `noindex` côté
 * page ; l'annoncer dans le sitemap enverrait un signal contradictoire à Google
 * et gaspillerait du budget d'exploration.
 */

import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { FRENCH_CITIES } from "@/lib/cities";
import { getAllArticles } from "@/lib/blog";
import { getSeoInventory, isIndexable } from "@/lib/seo/inventory";
import {
  COMPARATIF_SLUGS,
  STATIC_PAGES,
  VOITURE_BUDGET_SLUGS,
  VOITURE_CLUSTER_SLUGS,
} from "@/lib/seo/static-routes";

const BASE = "https://www.dealandcompany.fr";

/** Le rendu lui-même est mis en cache 6 h, en plus de l'instantané. */
export const revalidate = 21600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const inv = await getSeoInventory();
  const now = new Date();
  const globalLastMod = inv.total > 0 ? inv.lastModified : now;

  const entries: MetadataRoute.Sitemap = [];

  // --- Pages permanentes -------------------------------------------------
  for (const page of STATIC_PAGES) {
    entries.push({
      url: page.path === "/" ? BASE : `${BASE}${page.path}`,
      lastModified: page.priority >= 0.8 ? globalLastMod : now,
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

  // --- Pages éditoriales à slug fixe --------------------------------------
  for (const slug of COMPARATIF_SLUGS) {
    entries.push({
      url: `${BASE}/comparatif/${slug}`,
      lastModified: globalLastMod,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }
  for (const slug of VOITURE_CLUSTER_SLUGS) {
    entries.push({
      url: `${BASE}/voiture/${slug}`,
      lastModified: globalLastMod,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }
  for (const slug of VOITURE_BUDGET_SLUGS) {
    entries.push({
      url: `${BASE}/voiture-budget/${slug}`,
      lastModified: globalLastMod,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // --- Listes : uniquement celles qui passent le seuil d'indexation -------
  for (const cat of CATEGORIES) {
    if (!isIndexable(inv.byCategory[cat.id] ?? 0)) continue;
    entries.push({
      url: `${BASE}/annonces/${cat.id}`,
      lastModified: globalLastMod,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  for (const [key, count] of Object.entries(inv.byCategorySub)) {
    if (!isIndexable(count)) continue;
    entries.push({
      url: `${BASE}/annonces/${key}`,
      lastModified: globalLastMod,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  for (const [key, count] of Object.entries(inv.byCategoryCity)) {
    if (!isIndexable(count)) continue;
    entries.push({
      url: `${BASE}/annonces/${key}`,
      lastModified: globalLastMod,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  for (const [key, count] of Object.entries(inv.byCategorySubCity)) {
    if (!isIndexable(count)) continue;
    entries.push({
      url: `${BASE}/annonces/${key}`,
      lastModified: globalLastMod,
      changeFrequency: "daily",
      priority: 0.6,
    });
  }

  const cityBySlug = new Map(FRENCH_CITIES.map((c) => [c.slug, c]));
  for (const [slug, count] of Object.entries(inv.byCity)) {
    if (!isIndexable(count) || !cityBySlug.has(slug)) continue;
    entries.push({
      url: `${BASE}/ville/${slug}`,
      lastModified: globalLastMod,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  for (const [slug, count] of Object.entries(inv.byBrand)) {
    if (!isIndexable(count)) continue;
    entries.push({
      url: `${BASE}/annonces/vehicules/${slug}`,
      lastModified: globalLastMod,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  for (const [key, count] of Object.entries(inv.byBrandModel)) {
    if (!isIndexable(count)) continue;
    entries.push({
      url: `${BASE}/annonces/vehicules/${key}`,
      lastModified: globalLastMod,
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
      priority: 0.8,
    });
  }

  // --- Annonces ------------------------------------------------------------
  for (const listing of inv.listings) {
    entries.push({
      url: `${BASE}${listing.path}`,
      lastModified: listing.lastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return entries;
}

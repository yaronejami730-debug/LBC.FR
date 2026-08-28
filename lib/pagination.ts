/**
 * Lecture du paramètre `?page=` — source unique.
 *
 * ── Le bug corrigé ────────────────────────────────────────────────────────
 *
 * Douze routes paginées écrivaient la même ligne :
 *
 *     const page = Math.max(1, parseInt(pageParam ?? "1", 10));
 *
 * Elle est fausse. `parseInt("abc", 10)` vaut `NaN`, et `Math.max(1, NaN)`
 * vaut `NaN` — pas 1. Le `NaN` se propageait jusqu'à `skip: (page - 1) * N`,
 * Prisma refusait l'argument, et la page répondait **500**.
 *
 * N'importe quelle URL paginée du site suffisait à le déclencher :
 *
 *     /annonces/loisirs/calais?page=abc
 *     /annonces/vehicules/renault?page=
 *     /voiture/suv-occasion?page=1x
 *
 * Ce n'est pas une hypothèse de laboratoire : ces variantes naissent toutes
 * seules d'un lien externe tronqué, d'un paramètre de suivi mal recopié ou
 * d'un agrégateur qui réécrit les URL — et Googlebot les essaie.
 *
 * ── Pourquoi cela compte au-delà des neuf URL ─────────────────────────────
 *
 * Une 5xx n'est pas une erreur locale. Googlebot l'interprète comme un serveur
 * en souffrance et **réduit sa fréquence d'exploration sur tout le domaine**.
 * C'est le seul motif du diagnostic à avoir un effet mécanique direct sur le
 * taux de crawl : neuf URL en erreur pèsent sur les deux mille autres.
 *
 * ── Le comportement retenu ────────────────────────────────────────────────
 *
 * Un paramètre illisible vaut page 1. Pas une erreur, pas un 404 : la page
 * demandée existe, seule sa pagination est du bruit. Elle répond 200, et le
 * `noindex` de la pagination fait le reste.
 */

/**
 * Borne haute. Au-delà, l'`OFFSET` n'a plus de sens : aucune liste du site
 * n'atteint dix mille pages, et un `?page=99999999999` ne mérite pas qu'on
 * demande à Postgres de compter jusque-là.
 */
export const MAX_PAGE = 10_000;

/**
 * Numéro de page sûr, toujours un entier de 1 à `MAX_PAGE`.
 *
 * Accepte ce que Next passe réellement dans `searchParams` : une chaîne, un
 * tableau (paramètre répété : `?page=2&page=3`), ou rien.
 */
export function parsePageParam(raw: string | string[] | undefined | null): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(String(value ?? "1"), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, MAX_PAGE);
}

/**
 * Chemin d'une liste paginée — la pagination est portée par le **chemin**, pas
 * par une query.
 *
 * ── Ce que `?page=` coûtait ───────────────────────────────────────────────
 *
 * `await searchParams` dans un composant serveur bascule la route en
 * dynamique. Silencieusement : `export const revalidate = 3600` et
 * `export const dynamicParams = false` restent écrits deux lignes plus haut et
 * cessent de s'appliquer. Next répond alors
 * `cache-control: private, no-cache, no-store`, qui écrase le
 * `public, s-maxage=3600` déclaré pour ces chemins dans `next.config.ts`.
 *
 * Relevé du 28/08/2026 sur les 362 URL du crawl d'audit : `MISS 284, HIT 75`.
 * Une fois `auth()` retiré de la fiche d'annonce, les MISS restants se
 * répartissaient en `/annonces/*` 55, `/voiture/*` 8, `/voiture-budget/*` 5 —
 * exactement les routes qui lisaient `?page=`. Chaque passage de Googlebot y
 * rejouait le rendu et ses requêtes Prisma, ce qui saturait le pool de
 * connexions et produisait les délais d'attente relevés le 11/08.
 *
 * La preuve par le contraire est nette : `/ville/[slug]` et
 * `/comparatif/[paire]`, qui ne lisent ni session ni `searchParams`,
 * répondent `public, s-maxage=3600` en HIT à 250-280 ms.
 *
 * ── Ce que la forme en chemin change ──────────────────────────────────────
 *
 * La page 1 n'a plus rien à lire : son URL ne porte aucun paramètre, la route
 * redevient prérendable, et le CDN sert le HTML sans réveiller Prisma. Les
 * pages 2 et suivantes vivent sur `/page/N`, rendues à la demande puis mises
 * en cache par le CDN comme n'importe quelle autre URL — elles restent
 * `noindex, follow`, la pagination ne porte aucune intention de recherche
 * propre.
 *
 * ⚠️ La page 1 n'est **jamais** `/page/1` : ce serait une seconde adresse pour
 * le même écran. Les routes `/page/[numero]` renvoient cette forme en 308 vers
 * l'URL de base.
 */
export function pagedPath(base: string, page: number): string {
  return page > 1 ? `${base}/page/${page}` : base;
}

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

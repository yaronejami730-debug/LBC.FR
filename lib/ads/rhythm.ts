/**
 * Cadence d'insertion dans une grille d'annonces.
 *
 * Une publicité toutes les cinq cartes, exactement, se repère au bout de deux
 * écrans : l'œil apprend la position et saute la case avant même de l'avoir
 * lue. C'est le pire résultat possible — l'annonceur paie une impression que
 * personne ne regarde.
 *
 * L'intervalle varie donc : cinq, puis sept, puis dix, puis six. La suite reste
 * **déterministe** — même page, même disposition — parce qu'un tirage à chaque
 * rendu ferait sauter les encarts d'une position à l'autre au moindre
 * re-rendu, et rendrait le comptage d'impressions ininterprétable.
 */

/** Intervalles successifs, en nombre de cartes entre deux encarts. */
const STEPS = [5, 7, 10, 6] as const;

/**
 * Positions d'insertion pour une grille de `count` cartes.
 *
 * Renvoie les index **après lesquels** un encart s'intercale. Le décalage
 * initial dépend de la page : sans lui, la première publicité tomberait au même
 * endroit sur chaque page de résultats.
 */
export function adPositions(count: number, page = 1): Set<number> {
  const positions = new Set<number>();
  if (count <= 0) return positions;

  let cursor = 0;
  let step = Math.max(0, page - 1) % STEPS.length;

  while (true) {
    cursor += STEPS[step % STEPS.length];
    step += 1;
    // Un encart en toute fin de grille se retrouve sous le dernier rang, là où
    // plus personne ne descend : on s'arrête avant.
    if (cursor >= count) break;
    positions.add(cursor - 1);
  }

  return positions;
}

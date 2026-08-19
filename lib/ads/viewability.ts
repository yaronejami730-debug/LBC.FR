/**
 * Visibilité réelle d'une publicité.
 *
 * Une publicité chargée n'est pas une publicité vue. Une page contient trois
 * encarts, le navigateur charge les trois, le visiteur n'en atteint qu'un :
 * compter trois impressions serait facturer deux fois du vide. C'est la faute
 * la plus courante des régies maison, et elle est invisible tant que personne
 * ne la cherche — les chiffres sont beaux, simplement faux.
 *
 * D'où quatre états distincts, et un seul qui coûte :
 *
 *  - `LOAD` — la publicité a été demandée et reçue par le client ;
 *  - `RENDER` — elle a été insérée dans la page ;
 *  - `VIEWABLE_IMPRESSION` — elle a été **réellement à l'écran** assez
 *    longtemps pour être vue ;
 *  - `CLICK` — quelqu'un a cliqué.
 *
 * Le seuil retenu est celui du métier : la moitié du bloc dans la fenêtre,
 * pendant une seconde continue. Ni inventé, ni négociable par le client — le
 * navigateur mesure, le serveur revalide. Un client peut mentir ; un client qui
 * annonce 100 % pendant une heure ne facture rien.
 */

/** Part minimale du bloc dans la fenêtre. */
export const MIN_VIEWPORT_RATIO = 0.5;
/** Durée minimale de visibilité continue, en millisecondes. */
export const MIN_VISIBLE_MS = 1000;

/**
 * Bornes de vraisemblance.
 *
 * Une durée de visibilité de six heures n'est pas une visite exceptionnelle,
 * c'est un onglet oublié ou un script. On plafonne plutôt que de refuser : la
 * seconde qui compte a bien eu lieu.
 */
const MAX_PLAUSIBLE_MS = 30 * 60_000;

export type ViewabilityInput = {
  /** Part du bloc dans la fenêtre au moment du franchissement, 0–1. */
  viewportPct: number;
  /** Durée cumulée au-dessus du seuil, en millisecondes. */
  visibleMs: number;
};

export type ViewabilityVerdict =
  | { viewable: true; viewportPct: number; visibleMs: number }
  | { viewable: false; reason: string; viewportPct: number; visibleMs: number };

/**
 * L'affichage remonté par le client est-il une impression visible ?
 *
 * Appelée **côté serveur**, sur des valeurs qui viennent du navigateur : c'est
 * exactement pour cela qu'elle existe. Le client sait mesurer, il n'a pas à
 * décider.
 */
export function assessViewability(input: ViewabilityInput): ViewabilityVerdict {
  const pct = Number(input.viewportPct);
  const ms = Number(input.visibleMs);

  if (!Number.isFinite(pct) || !Number.isFinite(ms)) {
    return { viewable: false, reason: "Mesure de visibilité illisible.", viewportPct: 0, visibleMs: 0 };
  }
  // Valeurs impossibles : plus de 100 % d'un bloc, ou une durée négative. Ce
  // n'est pas une mesure imprécise, c'est une mesure fabriquée.
  if (pct < 0 || pct > 1.0001 || ms < 0) {
    return { viewable: false, reason: "Mesure de visibilité impossible.", viewportPct: pct, visibleMs: ms };
  }

  const clampedMs = Math.min(Math.round(ms), MAX_PLAUSIBLE_MS);
  const clampedPct = Math.min(pct, 1);

  if (clampedPct < MIN_VIEWPORT_RATIO) {
    return {
      viewable: false,
      reason: `Moins de ${Math.round(MIN_VIEWPORT_RATIO * 100)} % du bloc à l'écran.`,
      viewportPct: clampedPct,
      visibleMs: clampedMs,
    };
  }
  if (clampedMs < MIN_VISIBLE_MS) {
    return {
      viewable: false,
      reason: `Visible moins de ${MIN_VISIBLE_MS} ms.`,
      viewportPct: clampedPct,
      visibleMs: clampedMs,
    };
  }

  return { viewable: true, viewportPct: clampedPct, visibleMs: clampedMs };
}

/**
 * Le pixel d'e-mail n'a pas d'observateur de visibilité.
 *
 * Un client de messagerie n'exécute pas de JavaScript : il charge une image ou
 * il ne la charge pas. On ne peut donc ni mesurer une surface, ni une durée.
 * L'ouverture est comptée comme impression visible — c'est la convention du
 * métier, avec ses limites connues — et marquée comme telle pour que personne
 * ne confonde plus tard cette mesure avec celle du web.
 */
export const EMAIL_VIEWABILITY: ViewabilityInput = {
  viewportPct: 1,
  visibleMs: MIN_VISIBLE_MS,
};

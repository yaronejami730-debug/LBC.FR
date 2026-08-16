/**
 * Faut-il chercher une plaque d'immatriculation sur cette photo ?
 *
 * Jusqu'ici la question n'était pas posée. Chaque image envoyée déclenchait
 * **deux** appels facturés à PlateRecognizer : un depuis le navigateur via
 * `/api/detect-plate`, un depuis `/api/upload`. Sur toutes les photos de la
 * plateforme — un canapé, une manucure, un avatar, un logo d'enseigne, une
 * photo d'équipe — et jusqu'à quinze secondes d'attente à chaque fois.
 *
 * Le tri se fait sur ce que l'annonce vend, jamais sur le fichier. Une BMW
 * Série 3 mérite l'analyse ; un massage bien-être, non.
 *
 * **En cas de doute, on analyse.** Une plaque publiée est une donnée
 * personnelle indirecte qu'on ne peut plus reprendre une fois l'annonce en
 * ligne ; un appel inutile coûte quelques centimes. L'asymétrie est trop forte
 * pour arbitrer autrement — d'où le verdict `unknown`, que l'appelant traite
 * comme un véhicule possible.
 *
 * Ce module reste volontairement sans dépendance : il part dans le bundle du
 * formulaire de publication. Le repli par le titre, qui a besoin du moteur de
 * catégorisation, vit dans `lib/plate-policy.server.ts`.
 */

/**
 * Rubriques où un véhicule immatriculé peut apparaître.
 *
 * Véhicules est l'évidence. Matériel professionnel en fait partie parce qu'un
 * tracteur, une nacelle ou un camion-benne portent une plaque et se
 * photographient devant l'atelier — souvent avec la voiture du patron dans le
 * cadre.
 */
const PLATE_CATEGORY_IDS = new Set(["vehicules", "materiel-pro"]);

/** Mêmes rubriques, écrites comme le formulaire les affiche. */
const PLATE_CATEGORY_LABELS = new Set(["vehicules", "materiel professionnel"]);

/** Sous-rubriques d'autres catégories où un véhicule est le sujet. */
const PLATE_SUBCATEGORIES = new Set(["locations de vacances"]);

export type PlateVerdict = "detect" | "skip" | "unknown";

export type PlateDecision = {
  verdict: PlateVerdict;
  /** Motif de la décision, journalisé côté serveur. */
  reason: string;
};

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** La rubrique donnée abrite-t-elle des véhicules immatriculés ? */
export function categoryCarriesPlates(
  categoryId: string | null | undefined,
  subcategory?: string | null,
): boolean {
  if (subcategory && PLATE_SUBCATEGORIES.has(normalizeLabel(subcategory))) return true;
  if (!categoryId) return false;
  const normalized = normalizeLabel(categoryId);
  // Le formulaire envoie tantôt l'identifiant (« vehicules »), tantôt le
  // libellé (« Véhicules ») : on accepte les deux plutôt que d'imposer une
  // convention que trois appelants finiraient par oublier.
  return PLATE_CATEGORY_IDS.has(normalized) || PLATE_CATEGORY_LABELS.has(normalized);
}

/**
 * Décision à partir de la seule rubrique. Fonction pure et sans dépendance.
 *
 * Rend `unknown` quand aucune rubrique n'est encore choisie : c'est à
 * l'appelant de trancher, en interrogeant le titre s'il le peut.
 */
export function platePolicyFromCategory(
  categoryId: string | null | undefined,
  subcategory?: string | null,
): PlateDecision {
  if (categoryCarriesPlates(categoryId, subcategory)) {
    return { verdict: "detect", reason: `rubrique « ${subcategory || categoryId} »` };
  }
  if (categoryId) {
    // Rubrique explicite hors périmètre : le titre ne peut plus rien y changer.
    // Si l'annonceur a choisi « Bien-être », il n'y a pas de plaque à chercher.
    return { verdict: "skip", reason: `rubrique « ${categoryId} » sans véhicule` };
  }
  return { verdict: "unknown", reason: "aucune rubrique choisie" };
}

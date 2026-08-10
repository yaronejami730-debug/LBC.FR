/**
 * Champs du formulaire de publication « Beauté & Bien-être ».
 *
 * Partagés entre le formulaire web (app/post/PostForm.tsx) et l'application
 * mobile, qui les récupère via /api/taxonomy. Une seule liste : les deux
 * écrans ne peuvent pas diverger, et une valeur ajoutée ici arrive dans
 * l'app sans nouvelle version du binaire.
 *
 * Les `value` sont ce que le serveur persiste dans `metadata.wellness`
 * (cf. app/api/listings/route.ts) — ne pas les renommer sans migration.
 */

export type WellnessOption = { value: string; label: string };

export const WELLNESS_DURATIONS: WellnessOption[] = [
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "1 h" },
  { value: "90", label: "1 h 30" },
  { value: "120", label: "2 h" },
  { value: "240", label: "Demi-journée" },
  { value: "480", label: "Journée" },
];

export const WELLNESS_PRICE_UNITS: WellnessOption[] = [
  { value: "seance", label: "La séance" },
  { value: "heure", label: "De l'heure" },
  { value: "personne", label: "Par personne" },
  { value: "demi_journee", label: "La demi-journée" },
  { value: "journee", label: "La journée" },
  { value: "mois", label: "Par mois" },
];

export const WELLNESS_TARIFF_TYPES: WellnessOption[] = [
  { value: "fixe", label: "Prix fixe" },
  { value: "par_heure", label: "Prix / heure" },
  { value: "par_personne", label: "Prix / personne" },
  { value: "par_seance", label: "Prix / séance" },
  { value: "a_partir_de", label: "À partir de" },
  { value: "forfait", label: "Forfait" },
];

export const WELLNESS_PLACES = ["En institut", "À domicile", "Les deux"];

/**
 * Un particulier publie une prestation à la fois ; la carte complète est
 * réservée à la fiche professionnelle. Sans cette règle la rubrique devient un
 * annuaire de salons éclaté en dizaines d'annonces.
 */
export const WELLNESS_ONE_PER_LISTING_NOTICE =
  "Une annonce = une prestation. Vous en proposez plusieurs ? Passez en compte professionnel et présentez votre carte complète sur une seule fiche.";

/** Nombre maximum de lignes de carte acceptées côté serveur pour un pro. */
export const WELLNESS_MAX_SERVICES = 20;

/**
 * Vocabulaire de l'interface professionnelle, par métier.
 *
 * « Prestations » ne veut rien dire pour un dépôt-vente automobile, qui parle
 * de véhicules, ni pour un loueur de bateau, qui parle de sorties. Écrire le
 * mot en dur dans les composants condamne l'interface à parler la langue d'un
 * seul métier.
 *
 * Tout le vocabulaire métier vit donc ici, indexé sur `activityType` — le même
 * identifiant de domaine que le catalogue et que les presets de capacités.
 * Ajouter un métier, c'est ajouter une ligne.
 */

export type Lexicon = {
  /** Rubrique des prestations réservables — « Prestations », « Séances »… */
  catalog: string;
  /** Au singulier, pour les boutons : « Ajouter une prestation ». */
  catalogOne: string;
  /** Rubrique des annonces — « Mes annonces », « Nos véhicules »… */
  listings: string;
  listingOne: string;
  /** Rubrique des services vitrine, non réservables. */
  offerings: string;
  /** Rubrique des activités à sessions. */
  activities: string;
  activityOne: string;
  /** L'équipe, et un de ses membres. */
  staff: string;
  staffOne: string;
  /** Le bouton d'appel à l'action de la fiche publique. */
  bookAction: string;
  /** Ce que le client réserve : « rendez-vous », « place », « séance ». */
  bookingOne: string;
};

const DEFAULT: Lexicon = {
  catalog: "Prestations",
  catalogOne: "prestation",
  listings: "Annonces",
  listingOne: "annonce",
  offerings: "Nos services",
  activities: "Activités",
  activityOne: "activité",
  staff: "L'équipe",
  staffOne: "praticien",
  bookAction: "Réserver",
  bookingOne: "rendez-vous",
};

/** Seules les différences avec le vocabulaire par défaut sont déclarées. */
const OVERRIDES: Record<string, Partial<Lexicon>> = {
  beaute: { staffOne: "coiffeur ou esthéticien" },
  bienetre: { catalog: "Soins", catalogOne: "soin", staffOne: "praticien" },
  sante: { catalog: "Consultations", catalogOne: "consultation", staffOne: "praticien", bookingOne: "consultation" },

  sport: {
    catalog: "Séances",
    catalogOne: "séance",
    activities: "Cours collectifs",
    activityOne: "cours",
    staff: "Coachs",
    staffOne: "coach",
    bookingOne: "séance",
  },
  formation: {
    catalog: "Cours",
    catalogOne: "cours",
    activities: "Sessions",
    activityOne: "session",
    staff: "Formateurs",
    staffOne: "formateur",
    bookingOne: "cours",
  },

  automobile: {
    catalog: "Rendez-vous",
    catalogOne: "rendez-vous",
    listings: "Véhicules",
    listingOne: "véhicule",
    staff: "Commerciaux",
    staffOne: "commercial",
    bookAction: "Prendre rendez-vous",
  },
  immobilier: {
    catalog: "Visites",
    catalogOne: "visite",
    listings: "Biens",
    listingOne: "bien",
    staff: "Négociateurs",
    staffOne: "négociateur",
    bookAction: "Demander une visite",
    bookingOne: "visite",
  },
  restauration: {
    catalog: "Menu",
    catalogOne: "plat",
    listings: "À la carte",
    listingOne: "plat",
    bookAction: "Réserver une table",
    bookingOne: "table",
  },

  evenementiel: {
    activities: "Sorties",
    activityOne: "sortie",
    staff: "Encadrants",
    staffOne: "encadrant",
    bookAction: "Réserver une place",
    bookingOne: "place",
  },
  spectacle: {
    activities: "Représentations",
    activityOne: "représentation",
    bookAction: "Réserver une place",
    bookingOne: "place",
  },
  audiovisuel: { catalog: "Prestations", staff: "Photographes", staffOne: "photographe" },

  btp: { catalog: "Interventions", catalogOne: "intervention", staff: "Équipes", staffOne: "artisan", bookingOne: "intervention" },
  depannage: { catalog: "Interventions", catalogOne: "intervention", staffOne: "technicien", bookingOne: "intervention" },
  jardin: { catalog: "Interventions", catalogOne: "intervention", staffOne: "jardinier", bookingOne: "intervention" },
  menage: { catalog: "Interventions", catalogOne: "intervention", staffOne: "intervenant", bookingOne: "intervention" },
  proprete: { catalog: "Interventions", catalogOne: "intervention", staffOne: "intervenant", bookingOne: "intervention" },
  informatique: { catalog: "Interventions", catalogOne: "intervention", staffOne: "technicien" },
  animaux: { staffOne: "intervenant" },
  transport: { catalog: "Courses", catalogOne: "course", staff: "Chauffeurs", staffOne: "chauffeur", bookingOne: "course" },
  juridique: { catalog: "Consultations", catalogOne: "consultation", staffOne: "conseil", bookingOne: "consultation" },
  conseil: { catalog: "Missions", catalogOne: "mission", staffOne: "consultant" },
  digital: { catalog: "Missions", catalogOne: "mission", staffOne: "consultant" },
  entreprise: { catalog: "Missions", catalogOne: "mission", staffOne: "intervenant" },
};

export function lexiconFor(activityType: string | null | undefined): Lexicon {
  if (!activityType) return DEFAULT;
  const overrides = OVERRIDES[activityType];
  return overrides ? { ...DEFAULT, ...overrides } : DEFAULT;
}

/** « une prestation » / « un véhicule » — l'article suit le mot, pas le métier. */
export function withArticle(word: string): string {
  return /^[aeiouyéèêà]/i.test(word) ? `un ${word}` : FEMININE.has(word) ? `une ${word}` : `un ${word}`;
}

/**
 * Genre des noms du lexique. Le français ne se devine pas depuis la chaîne :
 * une liste explicite vaut mieux qu'une heuristique qui écrira « un place ».
 */
const FEMININE = new Set([
  "prestation",
  "annonce",
  "activité",
  "séance",
  "session",
  "visite",
  "sortie",
  "représentation",
  "intervention",
  "consultation",
  "mission",
  "course",
  "place",
  "table",
]);

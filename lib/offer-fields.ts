/**
 * Schéma de champs de publication, dérivé de l'intention de l'annonce.
 *
 * Une prestation n'a pas d'état, une offre d'emploi n'a pas de marque, une
 * location a une caution que personne d'autre n'a. Plutôt que de semer des
 * conditions dans deux formulaires (web et mobile) qui divergeront, la
 * définition vit ici et les écrans la lisent.
 *
 * Deux familles de champs :
 *   — `core` : les champs déjà câblés dans les formulaires (état, marque,
 *     véhicule, immobilier, détails de prestation). Un booléen suffit.
 *   — `extra` : des champs déclarés en données pures, rendus par un composant
 *     générique et rangés dans `metadata.fields`. C'est ce qui permet d'ajouter
 *     « caution » ou « type de contrat » sans publier une nouvelle version de
 *     l'application mobile — elle lit le schéma via /api/taxonomy.
 *
 * Les `value` sont persistées : ne pas les renommer sans migration.
 */

export type FieldSetId =
  | "bien"
  | "vehicule"
  | "immobilier-vente"
  | "immobilier-location"
  | "prestation"
  | "prestation-bien-etre"
  | "location-bien"
  | "emploi"
  | "demande"
  | "don"
  | "evenement";

/** Vocabulaire de l'interface. Dire « article » d'une manucure est le bug d'origine. */
export type Lexicon = "objet" | "prestation" | "logement" | "poste" | "evenement" | "recherche";

/** Champs déjà implémentés dans les formulaires — pilotés par un booléen. */
export type CoreFieldId =
  | "condition"
  | "brand"
  | "model"
  | "year"
  | "vehicle"
  | "immo"
  | "serviceDetails"
  | "serviceCard";

export const CORE_FIELD_IDS: CoreFieldId[] = [
  "condition",
  "brand",
  "model",
  "year",
  "vehicle",
  "immo",
  "serviceDetails",
  "serviceCard",
];

export type ExtraField = {
  /** Clé persistée dans `metadata.fields`. */
  id: string;
  label: string;
  type: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
  suffix?: string;
  required?: boolean;
};

export type FieldSetSpec = {
  id: FieldSetId;
  /** Libellé humain du régime, affiché quand le moteur reclasse une annonce. */
  label: string;
  lexicon: Lexicon;
  core: Record<CoreFieldId, boolean>;
  extra: ExtraField[];
  labels: {
    /** Titre de l'étape « description » du formulaire web. */
    descriptionStep: string;
    /** Libellé du champ prix. */
    price: string;
    /** Aide affichée sous le champ titre. */
    titleHint: string;
    /** Ce qui est publié, au singulier — « votre annonce », « votre prestation ». */
    noun: string;
  };
};

const NONE: Record<CoreFieldId, boolean> = {
  condition: false,
  brand: false,
  model: false,
  year: false,
  vehicle: false,
  immo: false,
  serviceDetails: false,
  serviceCard: false,
};

/** Options partagées — déclarées une fois, servies au web et au mobile. */
const RENTAL_DURATIONS: ExtraField["options"] = [
  { value: "heure", label: "À l'heure" },
  { value: "jour", label: "À la journée" },
  { value: "week_end", label: "Le week-end" },
  { value: "semaine", label: "À la semaine" },
  { value: "mois", label: "Au mois" },
];

const CONTRACT_TYPES: ExtraField["options"] = [
  { value: "cdi", label: "CDI" },
  { value: "cdd", label: "CDD" },
  { value: "interim", label: "Intérim" },
  { value: "alternance", label: "Alternance" },
  { value: "stage", label: "Stage" },
  { value: "freelance", label: "Freelance" },
];

const WORK_TIMES: ExtraField["options"] = [
  { value: "temps_plein", label: "Temps plein" },
  { value: "temps_partiel", label: "Temps partiel" },
  { value: "ponctuel", label: "Ponctuel" },
];

export const FIELD_SETS: Record<FieldSetId, FieldSetSpec> = {
  bien: {
    id: "bien",
    label: "Objet à vendre",
    lexicon: "objet",
    core: { ...NONE, condition: true, brand: true, model: true, year: true },
    extra: [],
    labels: {
      descriptionStep: "Description & état",
      price: "Prix (€)",
      titleHint: "Décrivez l'objet : marque, modèle, état.",
      noun: "annonce",
    },
  },

  vehicule: {
    id: "vehicule",
    label: "Véhicule",
    lexicon: "objet",
    core: { ...NONE, condition: true, brand: true, model: true, year: true, vehicle: true },
    extra: [],
    labels: {
      descriptionStep: "Description & état",
      price: "Prix (€)",
      titleHint: "Marque, modèle, année, kilométrage.",
      noun: "annonce",
    },
  },

  "immobilier-vente": {
    id: "immobilier-vente",
    label: "Bien immobilier à vendre",
    lexicon: "logement",
    core: { ...NONE, immo: true },
    extra: [
      {
        id: "dpe",
        label: "Classe énergie (DPE)",
        type: "select",
        options: ["A", "B", "C", "D", "E", "F", "G"].map((v) => ({ value: v, label: v })),
      },
    ],
    labels: {
      descriptionStep: "Description du bien",
      price: "Prix de vente (€)",
      titleHint: "Type de bien, surface, ville.",
      noun: "annonce",
    },
  },

  "immobilier-location": {
    id: "immobilier-location",
    label: "Bien immobilier à louer",
    lexicon: "logement",
    core: { ...NONE, immo: true },
    extra: [
      { id: "charges", label: "Charges (€ / mois)", type: "number", suffix: "€" },
      { id: "deposit", label: "Dépôt de garantie (€)", type: "number", suffix: "€" },
      {
        id: "dpe",
        label: "Classe énergie (DPE)",
        type: "select",
        options: ["A", "B", "C", "D", "E", "F", "G"].map((v) => ({ value: v, label: v })),
      },
    ],
    labels: {
      descriptionStep: "Description du bien",
      price: "Loyer (€ / mois)",
      titleHint: "Type de bien, surface, ville.",
      noun: "annonce",
    },
  },

  prestation: {
    id: "prestation",
    label: "Prestation",
    lexicon: "prestation",
    core: { ...NONE, serviceDetails: true },
    extra: [],
    labels: {
      descriptionStep: "Description de la prestation",
      price: "Tarif (€)",
      titleHint: "Dites ce que vous faites, où, et pour quel tarif.",
      noun: "prestation",
    },
  },

  "prestation-bien-etre": {
    id: "prestation-bien-etre",
    label: "Prestation bien-être",
    lexicon: "prestation",
    core: { ...NONE, serviceDetails: true, serviceCard: true },
    extra: [],
    labels: {
      descriptionStep: "Description de la prestation",
      price: "Tarif (€)",
      titleHint: "Le soin, sa durée, le lieu, ce que le tarif couvre.",
      noun: "prestation",
    },
  },

  "location-bien": {
    id: "location-bien",
    label: "Location",
    lexicon: "objet",
    // Un bien loué garde un état : le locataire veut savoir ce qu'il reçoit.
    core: { ...NONE, condition: true, brand: true },
    extra: [
      { id: "rentalUnit", label: "Tarif appliqué", type: "select", options: RENTAL_DURATIONS },
      { id: "minDuration", label: "Durée minimale", type: "text", placeholder: "ex : 2 nuits" },
      { id: "deposit", label: "Caution (€)", type: "number", suffix: "€" },
      { id: "availability", label: "Disponibilité", type: "text", placeholder: "ex : à partir du 15 mars" },
    ],
    labels: {
      descriptionStep: "Description & conditions de location",
      price: "Tarif de location (€)",
      titleHint: "Ce que vous louez, pour quelle durée, à quel tarif.",
      noun: "location",
    },
  },

  emploi: {
    id: "emploi",
    label: "Offre d'emploi",
    lexicon: "poste",
    core: { ...NONE },
    extra: [
      { id: "contractType", label: "Type de contrat", type: "select", options: CONTRACT_TYPES, required: true },
      { id: "workTime", label: "Temps de travail", type: "select", options: WORK_TIMES },
      { id: "experience", label: "Expérience demandée", type: "text", placeholder: "ex : 2 ans" },
    ],
    labels: {
      descriptionStep: "Description du poste",
      price: "Salaire indicatif (€ / mois)",
      titleHint: "Intitulé du poste, contrat, lieu.",
      noun: "offre",
    },
  },

  demande: {
    id: "demande",
    label: "Recherche",
    lexicon: "recherche",
    // Une demande ne décrit pas un état : elle décrit un besoin.
    core: { ...NONE, brand: true, model: true },
    extra: [{ id: "budgetMax", label: "Budget maximum (€)", type: "number", suffix: "€" }],
    labels: {
      descriptionStep: "Ce que vous recherchez",
      price: "Budget (€)",
      titleHint: "Dites ce que vous cherchez et votre budget.",
      noun: "recherche",
    },
  },

  don: {
    id: "don",
    label: "Don",
    lexicon: "objet",
    core: { ...NONE, condition: true },
    extra: [],
    labels: {
      descriptionStep: "Description & état",
      price: "Prix (€)",
      titleHint: "Décrivez l'objet donné et son état.",
      noun: "don",
    },
  },

  evenement: {
    id: "evenement",
    label: "Événement",
    lexicon: "evenement",
    core: { ...NONE },
    extra: [
      { id: "eventDate", label: "Date", type: "text", placeholder: "ex : samedi 14 juin" },
      { id: "eventPlace", label: "Lieu précis", type: "text", placeholder: "ex : salle des fêtes" },
    ],
    labels: {
      descriptionStep: "Description de l'événement",
      price: "Participation (€)",
      titleHint: "Quoi, quand, où.",
      noun: "événement",
    },
  },
};

/** Champs à ne pas demander pour ce régime — « condition » en tête. */
export function suppressedFields(fieldSet: FieldSetId): CoreFieldId[] {
  const spec = FIELD_SETS[fieldSet];
  return CORE_FIELD_IDS.filter((id) => !spec.core[id]);
}

/** Le régime demande-t-il l'état de l'objet ? */
export function fieldSetAsksCondition(fieldSet: FieldSetId): boolean {
  return FIELD_SETS[fieldSet].core.condition;
}

/** Identifiants des champs extra d'un régime — sert à filtrer `metadata.fields`. */
export function extraFieldIds(fieldSet: FieldSetId): string[] {
  return FIELD_SETS[fieldSet].extra.map((f) => f.id);
}

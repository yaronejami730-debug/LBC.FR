/**
 * Formulaires spécialisés par sous-catégorie « Bien-être & Beauté ».
 *
 * Un même écran ne peut pas servir un massage, une dépose de semi-permanent et
 * une épilation laser : les questions n'ont rien à voir. Le schéma ci-dessous
 * décrit, pour chaque sous-catégorie, les seuls champs qui ont un sens — et
 * `showIf` fait disparaître ceux qui dépendent d'une réponse précédente
 * (le type de masque n'apparaît que si l'on a dit « avec masque »).
 *
 * Le même schéma alimente deux écrans : l'annonce d'un particulier (une
 * prestation) et l'ajout d'une ligne à la carte d'un professionnel. Une seule
 * source de vérité, donc deux écrans qui ne divergent jamais.
 */

export type WellnessField = {
  id: string;
  label: string;
  kind: "pills" | "select" | "number";
  options?: string[];
  /** Unité affichée à droite d'un champ numérique. */
  suffix?: string;
  required?: boolean;
  /** Affiché seulement si la condition est vraie. */
  showIf?: (values: Record<string, string>) => boolean;
};

/** Durée — commune à presque toutes les prestations. */
const DUREE: WellnessField = {
  id: "durationMin",
  label: "Durée",
  kind: "pills",
  options: ["15", "30", "45", "60", "90", "120"],
};

const TARIF: WellnessField = {
  id: "tariffType",
  label: "Type de tarif",
  kind: "select",
  options: ["Prix de la séance", "Prix à l'heure", "À partir de", "Forfait"],
};

const LIEU: WellnessField = {
  id: "place",
  label: "Lieu",
  kind: "pills",
  options: ["En institut", "À domicile", "Les deux"],
};

export const WELLNESS_FORMS: Record<string, WellnessField[]> = {
  Massage: [
    {
      id: "prestation",
      label: "Prestation",
      kind: "pills",
      required: true,
      options: [
        "Massage relaxant", "Massage sportif", "Massage du dos", "Massage crânien",
        "Massage californien", "Massage suédois", "Massage thaï", "Massage balinais",
        "Massage ayurvédique", "Pierres chaudes", "Massage prénatal", "Massage assis",
        "Réflexologie", "Drainage lymphatique", "Modelage corps",
      ],
    },
    DUREE,
    TARIF,
    LIEU,
  ],

  Onglerie: [
    {
      id: "prestation",
      label: "Type de prestation",
      kind: "pills",
      required: true,
      options: ["Pose", "Dépose", "Pose + dépose", "Remplissage", "Réparation", "Manucure", "Beauté des pieds"],
    },
    {
      id: "technique",
      label: "Technique",
      kind: "pills",
      options: ["Vernis classique", "Semi-permanent", "Gel", "Résine", "Acrygel", "Capsules"],
      // Une dépose se fait sur une technique, une manucure simple non.
      showIf: (v) => v.prestation !== "Manucure" && v.prestation !== "Beauté des pieds",
    },
    {
      id: "finition",
      label: "Finition",
      kind: "pills",
      options: ["Naturelle", "French", "Nail art"],
      showIf: (v) => v.prestation !== "Dépose",
    },
    // Pas de durée en onglerie : ce qui décrit la prestation, c'est la
    // technique et la finition, pas le temps passé.
    TARIF,
  ],

  "Sourcils & cils": [
    {
      id: "prestation",
      label: "Prestation",
      kind: "pills",
      required: true,
      options: [
        "Épilation sourcils", "Restructuration", "Brow lift", "Teinture sourcils",
        "Microblading", "Microshading", "Extension de cils", "Rehaussement de cils",
        "Teinture cils", "Lash lift",
      ],
    },
    {
      id: "methode",
      label: "Méthode d'épilation",
      kind: "pills",
      options: ["Cire", "Pince", "Fil", "Sans épilation"],
      // Seules les prestations d'épilation posent la question.
      showIf: (v) => v.prestation === "Épilation sourcils" || v.prestation === "Restructuration",
    },
    DUREE,
    TARIF,
  ],

  Maquillage: [
    {
      id: "prestation",
      label: "Type",
      kind: "pills",
      required: true,
      options: [
        "Maquillage naturel", "Maquillage soirée", "Maquillage mariage",
        "Maquillage événementiel", "Cours de maquillage", "Autre",
      ],
    },
    DUREE,
    TARIF,
    LIEU,
  ],

  "Soins du visage": [
    {
      id: "prestation",
      label: "Type de soin",
      kind: "pills",
      required: true,
      options: [
        "Nettoyage de peau", "Hydratant", "Purifiant", "Anti-âge", "Éclat",
        "Peau sensible", "Peeling", "Hydrafacial", "Microneedling",
      ],
    },
    { id: "masque", label: "Avec masque", kind: "pills", options: ["Oui", "Non"] },
    {
      id: "typeMasque",
      label: "Type de masque",
      kind: "pills",
      options: ["Hydratant", "Purifiant", "Apaisant", "Anti-âge", "Éclat"],
      showIf: (v) => v.masque === "Oui",
    },
    DUREE,
    TARIF,
  ],

  Épilation: [
    {
      id: "zone",
      label: "Zone",
      kind: "pills",
      required: true,
      options: [
        "Sourcils", "Visage", "Lèvre", "Aisselles", "Bras", "Demi-jambes", "Jambes complètes",
        "Maillot", "Maillot intégral", "Dos", "Torse", "Corps entier",
      ],
    },
    {
      id: "methode",
      label: "Méthode",
      kind: "pills",
      required: true,
      options: ["Cire", "Fil oriental", "Laser", "Lumière pulsée", "Autre"],
    },
    {
      id: "seances",
      label: "Nombre de séances du forfait",
      kind: "number",
      suffix: "séances",
      // Le laser et la lumière pulsée se vendent par cure, pas à l'unité.
      showIf: (v) => v.methode === "Laser" || v.methode === "Lumière pulsée",
    },
    DUREE,
    TARIF,
  ],

  Coiffure: [
    {
      id: "prestation",
      label: "Prestation",
      kind: "pills",
      required: true,
      options: [
        "Coupe femme", "Coupe homme", "Coupe enfant", "Brushing", "Coloration", "Mèches",
        "Balayage", "Ombré hair", "Lissage", "Permanente", "Extensions", "Chignon",
        "Tresses", "Locks", "Taille de barbe", "Rasage", "Coupe + barbe",
      ],
    },
    DUREE,
    TARIF,
    LIEU,
  ],

  "Spa & détente": [
    {
      id: "prestation",
      label: "Type",
      kind: "pills",
      required: true,
      options: ["Spa / jacuzzi", "Sauna", "Hammam", "Espace détente", "Location d'espace bien-être"],
    },
    {
      id: "capacity",
      label: "Nombre de personnes",
      kind: "pills",
      options: ["1", "2", "3", "4", "5", "6+"],
      // Un spa se vend au créneau pour un groupe ; les autres rubriques non.
      showIf: (v) => v.prestation !== "",
    },
    { ...DUREE, label: "Durée du créneau" },
    {
      id: "creneaux",
      label: "Créneaux disponibles",
      kind: "select",
      options: ["Tous les jours", "En semaine", "Le week-end", "Sur rendez-vous"],
      showIf: (v) => v.prestation === "Location d'espace bien-être",
    },
    TARIF,
  ],

  "Location d'espace bien-être": [
    {
      id: "prestation",
      label: "Espace proposé",
      kind: "pills",
      required: true,
      options: [
        "Cabine de massage", "Cabine esthétique", "Salle de massage", "Fauteuil de coiffure",
        "Poste d'onglerie", "Institut complet", "Hammam", "Sauna", "Spa",
      ],
    },
    {
      id: "rythme",
      label: "Location",
      kind: "pills",
      required: true,
      options: ["À l'heure", "À la demi-journée", "À la journée", "Au mois"],
    },
    TARIF,
  ],

  "Sport & récupération": [
    {
      id: "prestation",
      label: "Prestation",
      kind: "pills",
      required: true,
      options: [
        "Massage sportif", "Récupération musculaire", "Étirements", "Coaching sportif",
        "Préparation physique", "Kinésithérapie", "Ostéopathie", "Cryothérapie", "Pressothérapie",
      ],
    },
    DUREE,
    TARIF,
    LIEU,
  ],

  "Relaxation & bien-être": [
    {
      id: "prestation",
      label: "Pratique",
      kind: "pills",
      required: true,
      options: [
        "Yoga", "Méditation", "Sophrologie", "Relaxation", "Respiration", "Pilates",
        "Reiki", "Réflexologie", "Développement personnel", "Atelier bien-être",
      ],
    },
    { id: "format", label: "Format", kind: "pills", options: ["Individuel", "En duo", "En groupe"] },
    DUREE,
    TARIF,
  ],
};

/** Champs à afficher pour une sous-catégorie et un état de saisie donnés. */
export function visibleFields(
  subcategory: string,
  values: Record<string, string>,
): WellnessField[] {
  return (WELLNESS_FORMS[subcategory] ?? []).filter((f) => !f.showIf || f.showIf(values));
}

/**
 * Résumé lisible d'une saisie : « Pose · Semi-permanent · French ».
 * Sert de libellé par défaut d'une ligne de carte professionnelle.
 */
export function summarizeWellnessValues(
  subcategory: string,
  values: Record<string, string>,
): string {
  const fields = visibleFields(subcategory, values);
  return fields
    .filter((f) => f.kind !== "number" && f.id !== "durationMin" && f.id !== "tariffType")
    .map((f) => values[f.id])
    .filter(Boolean)
    .join(" · ");
}

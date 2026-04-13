export type FilterType = "range" | "select" | "text" | "number";

export interface FilterField {
  key: string;
  label: string;
  type: FilterType;
  options?: string[]; // for select
  emptyLabel?: string; // override "Peu importe" for the empty option
  unit?: string;       // e.g. "km", "m²", "€"
  min?: number;
  max?: number;
}

export interface FilterGroup {
  label: string;
  fields: FilterField[];
}

// Common filters shown for all categories
export const COMMON_FILTERS: FilterGroup[] = [
  {
    label: "Trier par",
    fields: [
      {
        key: "sort",
        label: "Trier par",
        type: "select",
        emptyLabel: "Plus récentes (défaut)",
        options: ["Prix croissant", "Prix décroissant", "Plus anciennes"],
      },
    ],
  },
  {
    label: "Prix",
    fields: [
      { key: "minPrice", label: "Prix min", type: "range", unit: "€" },
      { key: "maxPrice", label: "Prix max", type: "range", unit: "€" },
    ],
  },
  {
    label: "Localisation",
    fields: [
      { key: "location", label: "Ville, département…", type: "text" },
    ],
  },
];

// Category-specific filters keyed by category id
export const CATEGORY_FILTERS: Record<string, FilterGroup[]> = {
  vehicules: [
    {
      label: "Type de véhicule",
      fields: [
        {
          key: "vehicleType",
          label: "Type",
          type: "select",
          options: ["Voiture", "Moto", "Utilitaire", "Caravane", "Autre"],
        },
      ],
    },
    {
      label: "Carburant",
      fields: [
        {
          key: "fuel",
          label: "Carburant",
          type: "select",
          options: ["Essence", "Diesel", "Électrique", "Hybride", "GPL"],
        },
      ],
    },
    {
      label: "Kilométrage",
      fields: [
        { key: "minKm", label: "Km min", type: "range", unit: "km" },
        { key: "maxKm", label: "Km max", type: "range", unit: "km" },
      ],
    },
    {
      label: "Année",
      fields: [
        { key: "minYear", label: "De", type: "number", min: 1970, max: 2026 },
        { key: "maxYear", label: "À", type: "number", min: 1970, max: 2026 },
      ],
    },
    {
      label: "Boîte de vitesse",
      fields: [
        {
          key: "gearbox",
          label: "Boîte",
          type: "select",
          options: ["Manuelle", "Automatique"],
        },
      ],
    },
  ],

  immobilier: [
    {
      label: "Type de bien",
      fields: [
        {
          key: "propertyType",
          label: "Type",
          type: "select",
          options: ["Appartement", "Maison", "Terrain", "Bureau", "Commerce", "Autre"],
        },
      ],
    },
    {
      label: "Transaction",
      fields: [
        {
          key: "transactionType",
          label: "Vente / Location",
          type: "select",
          options: ["Vente", "Location", "Colocation"],
        },
      ],
    },
    {
      label: "Surface (m²)",
      fields: [
        { key: "minSurface", label: "Min", type: "range", unit: "m²" },
        { key: "maxSurface", label: "Max", type: "range", unit: "m²" },
      ],
    },
    {
      label: "Pièces",
      fields: [
        { key: "minRooms", label: "Nb min", type: "number", min: 1, max: 20 },
        { key: "maxRooms", label: "Nb max", type: "number", min: 1, max: 20 },
      ],
    },
  ],

  multimedia: [
    {
      label: "Type",
      fields: [
        {
          key: "deviceType",
          label: "Catégorie",
          type: "select",
          options: ["Téléphone", "Ordinateur", "Tablette", "Console", "TV / Écran", "Appareil photo", "Autre"],
        },
      ],
    },
    {
      label: "État",
      fields: [
        {
          key: "condition",
          label: "État",
          type: "select",
          options: ["Neuf", "Très bon état", "Bon état", "État correct"],
        },
      ],
    },
  ],

  mode: [
    {
      label: "Taille",
      fields: [
        {
          key: "size",
          label: "Taille",
          type: "select",
          options: ["XXS", "XS", "S", "M", "L", "XL", "XXL", "Autre"],
        },
      ],
    },
    {
      label: "État",
      fields: [
        {
          key: "condition",
          label: "État",
          type: "select",
          options: ["Neuf avec étiquette", "Neuf sans étiquette", "Très bon état", "Bon état", "État correct"],
        },
      ],
    },
  ],

  emploi: [
    {
      label: "Type de contrat",
      fields: [
        {
          key: "contractType",
          label: "Contrat",
          type: "select",
          options: ["CDI", "CDD", "Intérim", "Stage", "Alternance", "Freelance"],
        },
      ],
    },
    {
      label: "Expérience",
      fields: [
        {
          key: "experience",
          label: "Expérience",
          type: "select",
          options: ["Débutant", "1-3 ans", "3-5 ans", "5-10 ans", "10+ ans"],
        },
      ],
    },
    {
      label: "Salaire (€/mois)",
      fields: [
        { key: "minPrice", label: "Min", type: "range", unit: "€" },
        { key: "maxPrice", label: "Max", type: "range", unit: "€" },
      ],
    },
  ],

  animaux: [
    {
      label: "Type d'animal",
      fields: [
        {
          key: "animalType",
          label: "Animal",
          type: "select",
          options: ["Chien", "Chat", "Oiseau", "Rongeur", "Reptile", "Poisson", "Autre"],
        },
      ],
    },
    {
      label: "Âge",
      fields: [
        {
          key: "animalAge",
          label: "Âge",
          type: "select",
          options: ["Moins de 1 an", "1-3 ans", "3-7 ans", "7 ans et plus"],
        },
      ],
    },
  ],

  "bebe-enfant": [
    {
      label: "Âge de l'enfant",
      fields: [
        {
          key: "childAge",
          label: "Âge",
          type: "select",
          options: ["0-6 mois", "6-12 mois", "1-2 ans", "2-3 ans", "3-5 ans", "5-8 ans", "8-12 ans"],
        },
      ],
    },
    {
      label: "État",
      fields: [
        {
          key: "condition",
          label: "État",
          type: "select",
          options: ["Neuf", "Très bon état", "Bon état", "État correct"],
        },
      ],
    },
  ],

  vacances: [
    {
      label: "Type d'hébergement",
      fields: [
        {
          key: "accommodationType",
          label: "Type",
          type: "select",
          options: ["Appartement", "Maison", "Villa", "Camping", "Chalet", "Chambre d'hôte", "Autre"],
        },
      ],
    },
    {
      label: "Capacité (personnes)",
      fields: [
        { key: "capacity", label: "Personnes max", type: "number", min: 1, max: 30 },
      ],
    },
  ],

  maison: [
    {
      label: "État",
      fields: [
        {
          key: "condition",
          label: "État",
          type: "select",
          options: ["Neuf", "Très bon état", "Bon état", "État correct"],
        },
      ],
    },
  ],

  loisirs: [
    {
      label: "Type",
      fields: [
        {
          key: "deviceType",
          label: "Catégorie",
          type: "select",
          options: ["Livres", "Jeux & jouets", "Musique / Instruments", "Sports & hobbies", "Vélos", "DVD / Films", "Autre"],
        },
      ],
    },
    {
      label: "État",
      fields: [
        {
          key: "condition",
          label: "État",
          type: "select",
          options: ["Neuf", "Très bon état", "Bon état", "État correct"],
        },
      ],
    },
  ],

  services: [
    {
      label: "Type de service",
      fields: [
        {
          key: "serviceType",
          label: "Type",
          type: "select",
          options: ["Services à la personne", "Réparations", "Événementiel", "Cours particuliers", "Services divers"],
        },
      ],
    },
  ],

  communaute: [
    {
      label: "Type",
      fields: [
        {
          key: "communityType",
          label: "Type",
          type: "select",
          options: ["Événements", "Associations", "Rencontres"],
        },
      ],
    },
  ],

  "materiel-pro": [
    {
      label: "Secteur",
      fields: [
        {
          key: "sector",
          label: "Secteur",
          type: "select",
          options: ["BTP / chantier", "Restauration", "Agriculture", "Industrie", "Autre"],
        },
      ],
    },
    {
      label: "État",
      fields: [
        {
          key: "condition",
          label: "État",
          type: "select",
          options: ["Neuf", "Très bon état", "Bon état", "État correct"],
        },
      ],
    },
  ],

  divers: [
    {
      label: "État",
      fields: [
        {
          key: "condition",
          label: "État",
          type: "select",
          options: ["Neuf", "Très bon état", "Bon état", "État correct"],
        },
      ],
    },
  ],
};

export function getFiltersForCategory(categoryId: string): FilterGroup[] {
  const specific = CATEGORY_FILTERS[categoryId] ?? [];
  // Emploi already defines its own price range, skip common price for it
  const common = categoryId === "emploi"
    ? COMMON_FILTERS.filter((g) => g.label !== "Prix")
    : COMMON_FILTERS;
  return [...specific, ...common];
}

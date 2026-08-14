/**
 * Inventaire publicitaire de Deal&Co.
 *
 * Une seule définition, ici. Les emplacements ne doivent jamais être écrits en
 * dur dans un composant : le jour où l'on ajoute « bandeau catégorie », il faut
 * qu'une ligne suffise, et que l'assistant de création, le moteur, les
 * statistiques et l'administration la voient tous en même temps.
 *
 * Les quatre premiers correspondent aux surfaces qui existent déjà dans
 * l'application — carrousel d'accueil, fil de résultats, encart de fiche
 * annonce, interstitiel mobile. On ne crée pas d'inventaire fictif.
 */

export const PLACEMENTS = [
  {
    key: "HOME_TOP",
    label: "Bandeau d'accueil",
    description: "En haut de la page d'accueil, dans le carrousel. La plus forte visibilité.",
    platform: "BOTH",
    format: "Bandeau large · 1200 × 400 px",
    surface: "Accueil",
  },
  {
    key: "SEARCH_GRID",
    label: "Fil de résultats",
    description: "Intégrée aux résultats de recherche, au même format qu'une annonce.",
    platform: "BOTH",
    format: "Carré · 800 × 800 px",
    surface: "Recherche",
  },
  {
    key: "LISTING_ROTATOR",
    label: "Encart fiche annonce",
    description: "À côté d'une annonce consultée. Touche un visiteur déjà en intention d'achat.",
    platform: "BOTH",
    format: "Vertical · 600 × 800 px",
    surface: "Annonce",
  },
  {
    key: "MOBILE_INTERSTITIAL",
    label: "Plein écran mobile",
    description: "À l'ouverture de l'application. Très visible, à réserver aux temps forts.",
    platform: "MOBILE",
    format: "Plein écran · 1080 × 1920 px",
    surface: "Application",
  },
] as const;

export type PlacementKey = (typeof PLACEMENTS)[number]["key"];
export type Placement = (typeof PLACEMENTS)[number];

const BY_KEY = new Map(PLACEMENTS.map((p) => [p.key, p]));

export function isPlacement(value: unknown): value is PlacementKey {
  return typeof value === "string" && BY_KEY.has(value as PlacementKey);
}

export function placement(key: string): Placement | null {
  return BY_KEY.get(key as PlacementKey) ?? null;
}

export function placementLabel(key: string): string {
  return BY_KEY.get(key as PlacementKey)?.label ?? key;
}

/**
 * Emplacements proposés pour une plateforme donnée.
 *
 * `BOTH` sort partout : une campagne web ne doit pas se voir proposer le plein
 * écran mobile, et réciproquement.
 */
export function placementsFor(platform: "WEB" | "MOBILE"): Placement[] {
  return PLACEMENTS.filter((p) => p.platform === "BOTH" || p.platform === platform);
}

/**
 * Objectifs de campagne.
 *
 * Ils ne changent pas la mécanique de diffusion — une impression reste une
 * impression. Ils changent ce que l'assistant demande, ce que le bouton
 * propose, et ce qu'on comptera comme conversion.
 */
export const OBJECTIVES = [
  {
    key: "VISIBILITE",
    label: "Plus de visibilité",
    description: "Faire connaître votre entreprise ou une offre.",
    icon: "visibility",
    defaultCta: "Découvrir",
  },
  {
    key: "VISITES",
    label: "Plus de visites",
    description: "Amener des visiteurs sur votre site.",
    icon: "trending_up",
    defaultCta: "En savoir plus",
  },
  {
    key: "CONTACTS",
    label: "Plus de contacts",
    description: "Recevoir des appels et des demandes.",
    icon: "call",
    defaultCta: "Contacter",
  },
  {
    key: "RESERVATIONS",
    label: "Plus de réservations",
    description: "Remplir votre agenda de rendez-vous.",
    icon: "event_available",
    defaultCta: "Réserver",
  },
  {
    key: "ANNONCE",
    label: "Promouvoir une annonce",
    description: "Mettre en avant une de vos annonces Deal&Co.",
    icon: "sell",
    defaultCta: "Voir l'annonce",
  },
] as const;

export type ObjectiveKey = (typeof OBJECTIVES)[number]["key"];

export function isObjective(value: unknown): value is ObjectiveKey {
  return typeof value === "string" && OBJECTIVES.some((o) => o.key === value);
}

export function objectiveLabel(key: string): string {
  return OBJECTIVES.find((o) => o.key === key)?.label ?? key;
}

/** Tranches d'âge proposées au ciblage. Vide = tout le monde. */
export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"] as const;

/** Statuts de campagne, dans l'ordre du cycle de vie. */
export const CAMPAIGN_STATUSES = {
  DRAFT: "Brouillon",
  PENDING_REVIEW: "En validation",
  SCHEDULED: "Programmée",
  ACTIVE: "Active",
  PAUSED: "Suspendue",
  ENDED: "Terminée",
  REJECTED: "Refusée",
} as const;

export type CampaignStatus = keyof typeof CAMPAIGN_STATUSES;

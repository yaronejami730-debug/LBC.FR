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
 *
 * Une surface reste volontairement vierge : **les brouillons**. Quelqu'un qui
 * relit une annonce inachevée est en train de travailler pour la place de
 * marché ; l'interrompre par une réclame le fait abandonner, et un brouillon
 * abandonné coûte plus cher que l'impression ne rapporte. La règle est écrite
 * ici et appliquée dans `components/ads/AdSlot`, pour qu'un ajout distrait ne
 * puisse pas la contourner.
 */

/** Chemins où aucune publicité n'est servie, quelle que soit la campagne. */
export const AD_FREE_PATHS = ["/brouillons"] as const;

export function isAdFreePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return AD_FREE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

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
  // ── Messagerie ────────────────────────────────────────────────────────────
  // Deux encarts, jamais au milieu des conversations : une réclame glissée
  // entre deux messages se lit comme un message, et c'est exactement ce qu'il
  // ne faut pas.
  {
    key: "MESSAGES_TOP",
    label: "Haut de la messagerie",
    description: "Au-dessus de la liste des conversations. Vue à chaque passage dans les messages.",
    platform: "BOTH",
    format: "Bandeau · 1200 × 300 px",
    surface: "Messagerie",
  },
  {
    key: "MESSAGES_BOTTOM",
    label: "Bas de la messagerie",
    description: "Sous la liste des conversations, après lecture. Moins vue, moins chère.",
    platform: "BOTH",
    format: "Bandeau · 1200 × 300 px",
    surface: "Messagerie",
  },
  // ── Dépôt d'annonce ───────────────────────────────────────────────────────
  {
    key: "POST_FORM",
    label: "Dépôt d'annonce",
    description: "Sous le formulaire de dépôt. Touche un vendeur, donc un futur acheteur.",
    platform: "BOTH",
    format: "Bandeau · 1200 × 300 px",
    surface: "Dépôt",
  },
  // ── Compte ────────────────────────────────────────────────────────────────
  {
    key: "PROFILE_BANNER",
    label: "Bandeau du profil",
    description: "Dans « Mon compte », entre les annonces et la confidentialité.",
    platform: "BOTH",
    format: "Bandeau · 1200 × 300 px",
    surface: "Compte",
  },
  // ── Accueil, entre les rayons ─────────────────────────────────────────────
  // Une seule clé pour les trois intercalaires de la page d'accueil — avant les
  // catégories, avant les bonnes affaires, avant les annonces récentes. Trois
  // clés distinctes donneraient à l'annonceur trois cases à cocher pour une
  // même idée : « au fil de l'accueil ». La position exacte est un choix
  // éditorial, pas un produit à vendre séparément.
  {
    key: "HOME_FEED",
    label: "Intercalaire d'accueil",
    description: "Entre les rayons de la page d'accueil : catégories, bonnes affaires, annonces récentes.",
    platform: "BOTH",
    format: "Bandeau large · 1200 × 400 px",
    surface: "Accueil",
  },
  // ── Menu et pages personnelles ────────────────────────────────────────────
  {
    key: "MENU_DRAWER",
    label: "Menu principal",
    description: "Dans le menu plein écran, au-dessus des rubriques. Vu à chaque ouverture du menu.",
    platform: "BOTH",
    format: "Vignette · 600 × 300 px",
    surface: "Menu",
  },
  {
    key: "FAVORITES",
    label: "Mes favoris",
    description: "En bas de la liste des favoris. Public qui a déjà une idée précise en tête.",
    platform: "BOTH",
    format: "Bandeau · 1200 × 300 px",
    surface: "Compte",
  },
  {
    key: "BOOKINGS",
    label: "Mes réservations",
    description: "Sur la page des rendez-vous pris. Public local, déjà client d'un professionnel.",
    platform: "BOTH",
    format: "Bandeau · 1200 × 300 px",
    surface: "Compte",
  },
  // ── Espace professionnel ──────────────────────────────────────────────────
  // Public rare et cher : des gérants d'établissement, sur leur outil de
  // travail. C'est l'inventaire qui intéresse les fournisseurs — logiciels,
  // grossistes, assurances — pas les mêmes annonceurs que le grand public.
  {
    key: "PRO_SPACE",
    label: "Espace professionnel",
    description: "Dans le tableau de bord des pros. Public de gérants d'entreprise.",
    platform: "BOTH",
    format: "Vignette · 600 × 300 px",
    surface: "Professionnels",
  },
  {
    key: "PRO_AGENDA",
    label: "Agenda professionnel",
    description: "Sur l'agenda des rendez-vous, consulté plusieurs fois par jour.",
    platform: "BOTH",
    format: "Vignette · 600 × 300 px",
    surface: "Professionnels",
  },
  // ── E-mail ────────────────────────────────────────────────────────────────
  // Une plateforme à part : pas de JavaScript, pas d'observateur de visibilité,
  // et un message qui peut être ouvert trois semaines plus tard. Le moteur le
  // sait, le jeton dure donc plus longtemps et l'impression se compte au pixel.
  {
    key: "EMAIL_BANNER",
    label: "Encart e-mail",
    description: "Dans les e-mails Deal&Co, sous le contenu. Hors e-mails de service.",
    platform: "EMAIL",
    format: "Vignette · 600 × 300 px",
    surface: "E-mail",
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
 * écran mobile, et réciproquement. L'e-mail ne sort que pour lui-même — un
 * créatif conçu pour un écran ne tient pas dans un client de messagerie.
 */
export function placementsFor(platform: "WEB" | "MOBILE" | "EMAIL"): Placement[] {
  if (platform === "EMAIL") return PLACEMENTS.filter((p) => p.platform === "EMAIL");
  return PLACEMENTS.filter((p) => p.platform === "BOTH" || p.platform === platform);
}

/**
 * Inventaire groupé par surface, dans l'ordre de déclaration.
 *
 * L'assistant de création affichait une grille plate ; à quatre emplacements
 * elle se lisait, à dix elle ne se lit plus. Le regroupement dit à l'annonceur
 * *où* il achète avant de lui demander *quoi*.
 */
export function placementsBySurface(
  platform?: "WEB" | "MOBILE" | "EMAIL",
): { surface: string; placements: Placement[] }[] {
  const list = platform ? placementsFor(platform) : [...PLACEMENTS];
  const groups: { surface: string; placements: Placement[] }[] = [];
  for (const p of list) {
    const group = groups.find((g) => g.surface === p.surface);
    if (group) group.placements.push(p);
    else groups.push({ surface: p.surface, placements: [p] });
  }
  return groups;
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

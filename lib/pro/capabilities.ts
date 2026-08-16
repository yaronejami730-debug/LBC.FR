/**
 * Capacités d'un établissement — ce qu'il peut faire, donc ce qu'il voit.
 *
 * Le principe : un professionnel n'est pas forcément un prestataire. Un salon
 * de coiffure vend des créneaux, un dépôt-vente automobile vend des voitures,
 * un loueur de bateau vend des places sur une sortie. Leur imposer le même
 * dashboard revient à afficher « Ajouter une prestation de 30 minutes » à un
 * garagiste.
 *
 * Il n'y a **pas** de type fermé `SERVICE_BOOKING | LISTING_SELLER | HYBRID` :
 * un type fermé oblige à en inventer un à chaque métier nouveau, et
 * « hybride » finit en fourre-tout. Ici, le métier ne fait que *proposer* un
 * jeu de capacités par défaut ; chacune reste activable par le professionnel.
 * L'hybride est donc une combinaison, pas une catégorie — un salon qui vend
 * son vieux matériel coche `listings`, et c'est tout.
 */

export const CAPABILITIES = [
  /** Publier des annonces sur la marketplace. */
  "listings",
  /** Décrire ses services en vitrine, sans durée ni réservation. */
  "offerings",
  /** Prestations réservables : durée + tarif + créneaux. */
  "services",
  /** Activités à sessions et places (sorties, cours collectifs). */
  "activities",
  /** Équipe et plannings. */
  "staff",
  /** Recevoir des réservations. */
  "bookings",
  /**
   * Tenir un stock : quantités, seuil d'alerte, mouvements.
   *
   * Distincte de `listings`. Publier une annonce et tenir un inventaire sont
   * deux gestes différents : un garage publie une voiture unique sans compter
   * d'unités, une boutique gère trente-sept t-shirts taille M dont une seule
   * annonce rend compte. Lier les deux capacités obligerait le garage à
   * décompter un stock qui vaut toujours 1.
   */
  "inventory",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export function isCapability(value: string): value is Capability {
  return (CAPABILITIES as readonly string[]).includes(value);
}

/**
 * Capacités par défaut selon le métier déclaré.
 *
 * Les clés sont les identifiants de domaine du catalogue
 * (`data/pro-catalog`) : une seule liste de métiers pour toute la plateforme,
 * plutôt qu'une énumération parallèle qui divergerait au premier ajout.
 *
 * Ce n'est qu'un point de départ. Rien ici n'interdit quoi que ce soit.
 */
const PRESETS: Record<string, Capability[]> = {
  // Prestations sur rendez-vous, avec équipe.
  beaute: ["offerings", "services", "staff", "bookings"],
  bienetre: ["offerings", "services", "staff", "bookings"],
  sante: ["offerings", "services", "staff", "bookings"],
  image: ["offerings", "services", "staff", "bookings"],
  juridique: ["offerings", "services", "staff", "bookings"],
  conseil: ["offerings", "services", "staff", "bookings"],
  funeraire: ["offerings", "services", "staff", "bookings"],

  // Interventions à domicile : rendez-vous, mais on vend aussi du matériel.
  menage: ["offerings", "services", "staff", "bookings"],
  aide_personne: ["offerings", "services", "staff", "bookings"],
  jardin: ["listings", "offerings", "services", "staff", "bookings"],
  btp: ["listings", "offerings", "services", "staff", "bookings"],
  depannage: ["offerings", "services", "staff", "bookings"],
  proprete: ["offerings", "services", "staff", "bookings"],
  energie: ["offerings", "services", "staff", "bookings"],
  informatique: ["listings", "offerings", "services", "staff", "bookings"],
  artisanat: ["listings", "offerings", "services", "staff", "bookings"],

  // Sessions et places : le créneau n'appartient pas à une personne mais à
  // une sortie, avec une capacité.
  sport: ["offerings", "services", "activities", "staff", "bookings"],
  formation: ["offerings", "services", "activities", "staff", "bookings"],
  evenementiel: ["listings", "offerings", "activities", "staff", "bookings"],
  spectacle: ["offerings", "activities", "staff", "bookings"],
  famille: ["offerings", "services", "activities", "staff", "bookings"],
  animaux: ["listings", "offerings", "services", "staff", "bookings"],
  audiovisuel: ["offerings", "services", "staff", "bookings"],

  // Le stock est le cœur de l'activité ; le rendez-vous, l'accessoire.
  automobile: ["listings", "offerings", "staff", "inventory"],
  immobilier: ["listings", "offerings", "staff"],
  restauration: ["listings", "offerings", "staff", "inventory"],
  transport: ["offerings", "services", "staff", "bookings"],
  securite: ["offerings", "services", "staff"],
  entreprise: ["offerings", "services", "staff", "bookings"],
  digital: ["offerings", "services", "staff", "bookings"],
};

/** Repli d'un métier inconnu : la vitrine seule, qui ne suppose rien. */
export const DEFAULT_CAPABILITIES: Capability[] = ["offerings"];

export function presetFor(activityType: string | null | undefined): Capability[] {
  if (!activityType) return DEFAULT_CAPABILITIES;
  return PRESETS[activityType] ?? DEFAULT_CAPABILITIES;
}

/**
 * Capacités effectives d'un établissement.
 *
 * `capabilities` est vide tant que le professionnel n'a rien réglé : on
 * retombe alors sur le preset de son métier. Un établissement configuré garde
 * ses choix, y compris s'il a tout décoché.
 */
export function capabilitiesOf(establishment: {
  activityType: string | null;
  capabilities: string;
}): Capability[] {
  const stored = parse(establishment.capabilities);
  if (stored === null) return presetFor(establishment.activityType);
  return stored;
}

export function has(caps: Capability[], capability: Capability): boolean {
  return caps.includes(capability);
}

/**
 * Nom lisible d'une capacité, pour expliquer un verrou.
 *
 * « Cette section demande la capacité `staff` » ne veut rien dire pour un
 * coiffeur. Ce qu'il comprend, c'est qu'il lui faut « Équipe et plannings ».
 */
export const CAPABILITY_LABELS: Record<Capability, string> = {
  listings: "Annonces sur la marketplace",
  offerings: "Vitrine de services",
  services: "Prestations réservables",
  activities: "Sorties et cours collectifs",
  staff: "Équipe et plannings",
  bookings: "Réservation en ligne",
  inventory: "Stock et quantités",
};

/**
 * Capacités qu'il faut activer *en même temps* qu'une capacité demandée.
 *
 * `normalize()` retire une capacité incohérente sans le dire — ce qui est
 * juste au moment de lire la base, mais faux au moment où quelqu'un clique
 * « Activer ». Un salon qui demandait la réservation en ligne voyait son
 * choix disparaître en silence, faute de `services` : le bouton semblait
 * mort. On complète donc la demande au lieu de la vider.
 */
export function prerequisitesFor(capability: Capability, current: Capability[]): Capability[] {
  if (capability !== "bookings") return [];
  if (current.includes("services") || current.includes("activities")) return [];
  // Réserver, c'est réserver *quelque chose*. `services` est le choix par
  // défaut : une prestation datée et tarifée, ce que fait la grande majorité
  // des établissements qui ouvrent un agenda.
  return ["services"];
}

/**
 * `bookings` sans `services` ni `activities` n'a rien à proposer : la
 * réservation resterait affichée sur un catalogue vide. On la retire plutôt
 * que d'afficher un tunnel sans issue.
 */
export function normalize(caps: Capability[]): Capability[] {
  const set = new Set(caps.filter(isCapability));
  if (set.has("bookings") && !set.has("services") && !set.has("activities")) {
    set.delete("bookings");
  }
  return CAPABILITIES.filter((c) => set.has(c));
}

export function serialize(caps: Capability[]): string {
  return JSON.stringify(normalize(caps));
}

/** `null` quand rien n'a été enregistré — à distinguer d'une liste vidée exprès. */
function parse(raw: string): Capability[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    if (parsed.length === 0) return null;
    return normalize(parsed.map(String).filter(isCapability));
  } catch {
    return null;
  }
}

/**
 * Registre des modules du dashboard professionnel.
 *
 * Toute la question « qu'est-ce que ce professionnel doit voir ? » se règle
 * ici. Ailleurs dans le code, il n'y a plus de condition métier : la
 * navigation se dérive de `modulesFor()`, et chaque route se protège d'une
 * ligne, `requireCapability()`.
 *
 * Ajouter un module = une entrée. Ajouter un métier = une ligne dans
 * `capabilities.ts`. Aucun composant à rouvrir.
 */
import type { Capability } from "./capabilities";
import type { Lexicon } from "./lexicon";

export type ProModuleId =
  | "fiche"
  | "annonces"
  | "prestations"
  | "activites"
  | "agenda"
  | "equipe"
  | "reservation"
  | "statistiques";

type ModuleDef = {
  id: ProModuleId;
  href: string;
  icon: string;
  /** Toutes ces capacités sont requises. Vide = module du socle commun. */
  requires: Capability[];
  /** Libellé, dérivé du lexique du métier. */
  label: (lex: Lexicon) => string;
};

const REGISTRY: ModuleDef[] = [
  {
    id: "fiche",
    href: "/profile/espace-pro",
    icon: "storefront",
    requires: [],
    label: () => "Ma fiche",
  },
  {
    id: "agenda",
    href: "/profile/espace-pro/agenda",
    icon: "calendar_month",
    requires: ["bookings"],
    label: () => "Agenda",
  },
  {
    id: "annonces",
    href: "/profile/espace-pro/annonces",
    icon: "sell",
    requires: ["listings"],
    label: (lex) => `Mes ${lex.listings.toLowerCase()}`,
  },
  {
    id: "prestations",
    href: "/profile/espace-pro/prestations",
    icon: "content_cut",
    requires: ["services"],
    label: (lex) => `Mes ${lex.catalog.toLowerCase()}`,
  },
  {
    id: "activites",
    href: "/profile/espace-pro/activites",
    icon: "sailing",
    requires: ["activities"],
    label: (lex) => `Mes ${lex.activities.toLowerCase()}`,
  },
  {
    id: "equipe",
    href: "/profile/espace-pro/equipe",
    icon: "group",
    requires: ["staff"],
    label: (lex) => `${lex.staff} et horaires`,
  },
  {
    id: "reservation",
    href: "/profile/espace-pro/parametres",
    icon: "tune",
    requires: ["bookings"],
    label: () => "Réservation",
  },
  {
    id: "statistiques",
    href: "/profile/espace-pro/statistiques",
    icon: "insights",
    requires: [],
    label: () => "Statistiques",
  },
];

export type ProModule = {
  id: ProModuleId;
  href: string;
  icon: string;
  label: string;
};

/** Modules visibles pour ces capacités, dans l'ordre du registre. */
export function modulesFor(capabilities: Capability[], lexicon: Lexicon): ProModule[] {
  return REGISTRY.filter((m) => m.requires.every((c) => capabilities.includes(c))).map((m) => ({
    id: m.id,
    href: m.href,
    icon: m.icon,
    label: m.label(lexicon),
  }));
}

/** Capacités exigées par un module — sert au garde-fou des routes. */
export function requirementsOf(id: ProModuleId): Capability[] {
  return REGISTRY.find((m) => m.id === id)?.requires ?? [];
}

/**
 * Certains modules ne sont pas encore construits. Les afficher mènerait sur
 * une 404, ce qui est pire que de ne pas les afficher : on les masque tant
 * que leur page n'existe pas.
 */
export const UNBUILT_MODULES: ProModuleId[] = ["annonces", "prestations", "activites", "statistiques"];

export function builtModulesFor(capabilities: Capability[], lexicon: Lexicon): ProModule[] {
  return modulesFor(capabilities, lexicon).filter((m) => !UNBUILT_MODULES.includes(m.id));
}

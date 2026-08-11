/**
 * Registre des réglages de l'espace professionnel.
 *
 * Même principe que `modules.ts`, appliqué un cran plus bas : la navigation
 * garde trois onglets (fiche, agenda, configuration) et tout ce qui se règle
 * une fois pour toutes — identité, horaires d'ouverture, équipe, plannings,
 * règles de réservation, établissements — vit derrière « Configuration ».
 *
 * Une section = une entrée. Elle apparaît si l'établissement a les capacités
 * requises et si le rôle du compte y donne droit. Aucun composant ne décide
 * cela lui-même : le hub lit ce registre, rien d'autre.
 */
import type { Capability } from "./capabilities";
import type { Lexicon } from "./lexicon";
import type { ProRole } from "./access";
import { canManageEstablishments } from "./access";

export type ConfigSectionId =
  | "fiche"
  | "horaires"
  | "equipe"
  | "reservation"
  | "etablissements";

type SectionDef = {
  id: ConfigSectionId;
  href: string;
  icon: string;
  /** Toutes ces capacités sont requises. Vide = section du socle commun. */
  requires: Capability[];
  /** Restriction de rôle, quand la section engage l'entreprise. */
  allows?: (role: ProRole) => boolean;
  title: (lex: Lexicon) => string;
  description: (lex: Lexicon) => string;
};

const REGISTRY: SectionDef[] = [
  {
    id: "fiche",
    href: "/profile/espace-pro",
    icon: "storefront",
    requires: [],
    title: () => "Identité de l'établissement",
    description: (lex) =>
      `Nom, description, adresse, téléphone, photo de couverture et carte des ${lex.catalog.toLowerCase()}.`,
  },
  {
    id: "horaires",
    href: "/profile/espace-pro/configuration/horaires",
    icon: "schedule",
    requires: [],
    title: () => "Horaires d'ouverture",
    description: () =>
      "Ce que vos clients lisent sur la fiche publique, jour par jour. Distinct des plannings de l'équipe.",
  },
  {
    id: "equipe",
    href: "/profile/espace-pro/equipe",
    icon: "group",
    requires: ["staff"],
    title: (lex) => `${lex.staff}, photos et plannings`,
    description: (lex) =>
      `Membres et photos de profil, ${lex.catalog.toLowerCase()} assurées par chacun, horaires de travail, pauses et absences.`,
  },
  {
    id: "reservation",
    href: "/profile/espace-pro/parametres",
    icon: "tune",
    requires: ["bookings"],
    title: () => "Règles de réservation",
    description: () =>
      "Pas des créneaux, délai de prévenance, confirmation automatique, annulation et report.",
  },
  {
    id: "etablissements",
    href: "/profile/espace-pro/configuration/etablissements",
    icon: "domain",
    requires: [],
    allows: canManageEstablishments,
    title: () => "Mes établissements",
    description: () =>
      "Ouvrir une deuxième boutique, en recopier la carte, basculer d'un point de vente à l'autre.",
  },
];

export type ConfigSection = {
  id: ConfigSectionId;
  href: string;
  icon: string;
  title: string;
  description: string;
  /** Faux quand une capacité manque : la section s'affiche, verrouillée. */
  available: boolean;
  /** Capacités qu'il faut activer pour ouvrir la section. */
  missing: Capability[];
};

/**
 * Sections du hub, dans l'ordre du registre.
 *
 * Une capacité manquante ne fait plus disparaître la section : elle la
 * verrouille. Cacher « Équipe » à un établissement dont le métier n'a jamais
 * été renseigné laissait le professionnel devant une page de configuration
 * incomplète, sans rien à cliquer ni raison affichée. Le rôle, lui, filtre
 * toujours : un MANAGER n'a pas à voir qu'il existe une porte « Mes
 * établissements » qu'il ne pourra jamais ouvrir.
 */
export function configSectionsFor(
  capabilities: Capability[],
  lexicon: Lexicon,
  role: ProRole,
): ConfigSection[] {
  return REGISTRY.filter((s) => s.allows?.(role) ?? true).map((s) => {
    const missing = s.requires.filter((c) => !capabilities.includes(c));
    return {
      id: s.id,
      href: s.href,
      icon: s.icon,
      title: s.title(lexicon),
      description: s.description(lexicon),
      available: missing.length === 0,
      missing,
    };
  });
}

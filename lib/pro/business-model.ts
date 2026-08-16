/**
 * « Que propose principalement votre entreprise ? »
 *
 * Cette question est posée à l'ouverture d'un établissement, et elle décide de
 * ce que le professionnel verra ensuite. Un coiffeur n'a pas à découvrir un
 * écran de gestion de stock ; un dépôt-vente n'a pas à régler des durées de
 * rendez-vous.
 *
 * Ce fichier ne définit **pas** un nouveau type de compte. Il traduit une
 * réponse humaine — trois choix compréhensibles — vers le vocabulaire déjà en
 * place : `capabilities`. La distinction services / produits existe donc en
 * base sous la forme d'une combinaison de capacités, jamais d'une étiquette
 * fermée. Un salon qui se met à vendre du shampoing coche `inventory` et rien
 * d'autre ne bouge ; il n'a pas à « changer de type de compte ».
 *
 * C'est aussi ce qui évite d'avoir à trancher les cas limites : un garage qui
 * fait de la réparation sur rendez-vous *et* vend des voitures n'est ni l'un ni
 * l'autre, il a les deux jeux de capacités.
 */

import type { Capability } from "./capabilities";

export const BUSINESS_MODELS = ["services", "products", "both"] as const;
export type BusinessModelChoice = (typeof BUSINESS_MODELS)[number];

export function isBusinessModelChoice(value: unknown): value is BusinessModelChoice {
  return typeof value === "string" && (BUSINESS_MODELS as readonly string[]).includes(value);
}

export type BusinessModelOption = {
  id: BusinessModelChoice;
  icon: string;
  title: string;
  /** Une phrase, à la deuxième personne : c'est lui qui répond. */
  summary: string;
  /** Métiers cités en exemple — reconnaître le sien vaut mieux qu'une définition. */
  examples: string;
  capabilities: Capability[];
};

export const BUSINESS_MODEL_OPTIONS: BusinessModelOption[] = [
  {
    id: "services",
    icon: "handshake",
    title: "Des services",
    summary: "Vous vendez des prestations, du temps ou de la main-d'œuvre.",
    examples: "Coiffure, massage, esthétique, dépannage, coaching, ménage, photographie…",
    capabilities: ["offerings", "services", "staff", "bookings"],
  },
  {
    id: "products",
    icon: "inventory_2",
    title: "Des produits",
    summary: "Vous vendez des biens physiques, avec des quantités disponibles.",
    examples: "Véhicules, mobilier, électronique, vêtements, matériel, produits en boutique…",
    capabilities: ["listings", "offerings", "inventory"],
  },
  {
    id: "both",
    icon: "swap_horiz",
    title: "Les deux",
    summary: "Vous proposez des prestations et vous vendez aussi des produits.",
    examples: "Un salon qui vend ses shampoings, un garage qui répare et revend…",
    capabilities: ["listings", "offerings", "services", "staff", "bookings", "inventory"],
  },
];

export function optionFor(choice: BusinessModelChoice): BusinessModelOption {
  return BUSINESS_MODEL_OPTIONS.find((o) => o.id === choice) ?? BUSINESS_MODEL_OPTIONS[0];
}

/** Capacités correspondant à une réponse. */
export function capabilitiesForChoice(choice: BusinessModelChoice): Capability[] {
  return [...optionFor(choice).capabilities];
}

/**
 * Lecture inverse : quel choix décrit le mieux un établissement déjà configuré ?
 *
 * Sert à ré-afficher la réponse dans les réglages, et à reprendre les
 * établissements créés avant que la question existe — leurs capacités viennent
 * du preset de leur métier, elles répondent donc déjà. Personne n'a à
 * re-répondre, et aucun compte n'est marqué « indéfini ».
 */
export function choiceFromCapabilities(caps: Capability[]): BusinessModelChoice {
  const sells = caps.includes("inventory") || caps.includes("listings");
  const serves = caps.includes("services") || caps.includes("bookings") || caps.includes("activities");

  if (sells && serves) return "both";
  if (sells) return "products";
  return "services";
}

/**
 * Le métier déclaré suggère-t-il déjà une réponse ?
 *
 * Quand le professionnel a choisi « Automobile », lui demander s'il vend des
 * produits est une question dont on connaît la réponse. On la présente
 * pré-sélectionnée plutôt que de la poser à blanc — il peut toujours en changer.
 */
export function suggestedChoice(capabilitiesFromPreset: Capability[]): BusinessModelChoice {
  return choiceFromCapabilities(capabilitiesFromPreset);
}

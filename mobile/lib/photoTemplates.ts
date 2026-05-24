import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type PhotoSlot = {
  key: string;
  label: string;
  hint?: string;
  icon: IoniconName;
  required?: boolean;
};

export type PhotoTemplate = {
  slots: PhotoSlot[];
  extraLabel: string;
  minPhotos: number;
  maxPhotos: number;
};

const TEMPLATES: Record<string, PhotoTemplate> = {
  vehicules: {
    minPhotos: 3,
    maxPhotos: 15,
    extraLabel: "Détails supplémentaires",
    slots: [
      { key: "front", label: "3/4 avant", hint: "Capot et phare", icon: "car-sport", required: true },
      { key: "back", label: "3/4 arrière", hint: "Hayon, feux", icon: "car", required: true },
      { key: "side", label: "Profil", hint: "Vue de côté", icon: "swap-horizontal" },
      { key: "interior", label: "Habitacle", hint: "Sièges, tableau de bord", icon: "speedometer", required: true },
      { key: "odometer", label: "Compteur km", hint: "Kilométrage visible", icon: "speedometer-outline" },
      { key: "engine", label: "Moteur", hint: "Compartiment moteur", icon: "settings" },
      { key: "carte-grise", label: "Carte grise", hint: "Floutez les infos perso", icon: "document-text" },
    ],
  },
  multimedia: {
    minPhotos: 2,
    maxPhotos: 10,
    extraLabel: "Photos supplémentaires",
    slots: [
      { key: "front", label: "Vue de face", hint: "Écran allumé idéalement", icon: "phone-portrait", required: true },
      { key: "back", label: "Vue arrière", hint: "Dos de l'appareil", icon: "phone-portrait-outline" },
      { key: "side", label: "Vue de côté", hint: "Tranches", icon: "swap-horizontal" },
      { key: "detail", label: "Vue détaillée", hint: "Zoom sur défauts éventuels", icon: "search" },
      { key: "box", label: "Emballage", hint: "Boîte d'origine", icon: "cube" },
      { key: "accessories", label: "Accessoires", hint: "Câble, chargeur...", icon: "git-network" },
      { key: "receipt", label: "Preuve d'achat", hint: "Facture (floutez les infos perso)", icon: "receipt" },
    ],
  },
  mode: {
    minPhotos: 2,
    maxPhotos: 8,
    extraLabel: "Photos supplémentaires",
    slots: [
      { key: "front", label: "Vue de face", hint: "Vêtement à plat ou porté", icon: "shirt", required: true },
      { key: "back", label: "Vue de dos", hint: "Arrière du vêtement", icon: "shirt-outline" },
      { key: "label", label: "Étiquette", hint: "Marque et taille", icon: "pricetag" },
      { key: "detail", label: "Détails", hint: "Tissu, coutures", icon: "search" },
      { key: "defect", label: "Défauts éventuels", hint: "Tâche, trou, usure", icon: "alert-circle" },
    ],
  },
  maison: {
    minPhotos: 2,
    maxPhotos: 10,
    extraLabel: "Photos supplémentaires",
    slots: [
      { key: "front", label: "Vue principale", hint: "Vue d'ensemble", icon: "bed", required: true },
      { key: "side", label: "Autre angle", hint: "Vue latérale", icon: "cube" },
      { key: "detail", label: "Détails", hint: "Matière, finition", icon: "search" },
      { key: "context", label: "En situation", hint: "Dans la pièce", icon: "home" },
      { key: "defect", label: "Défauts éventuels", hint: "Rayure, usure", icon: "alert-circle" },
    ],
  },
  immobilier: {
    minPhotos: 5,
    maxPhotos: 20,
    extraLabel: "Autres pièces",
    slots: [
      { key: "facade", label: "Façade", hint: "Vue extérieure", icon: "business", required: true },
      { key: "living", label: "Salon", hint: "Pièce principale", icon: "tv", required: true },
      { key: "kitchen", label: "Cuisine", hint: "Vue d'ensemble", icon: "restaurant", required: true },
      { key: "bedroom", label: "Chambre", hint: "Chambre principale", icon: "bed", required: true },
      { key: "bathroom", label: "Salle de bain", hint: "Vue d'ensemble", icon: "water", required: true },
      { key: "plan", label: "Plan", hint: "Plan de l'appartement", icon: "map" },
      { key: "view", label: "Vue", hint: "Depuis les fenêtres", icon: "eye" },
    ],
  },
  loisirs: {
    minPhotos: 2,
    maxPhotos: 8,
    extraLabel: "Photos supplémentaires",
    slots: [
      { key: "front", label: "Vue principale", icon: "image", required: true },
      { key: "back", label: "Autre angle", icon: "image-outline" },
      { key: "detail", label: "Détails", hint: "Matière, état", icon: "search" },
      { key: "defect", label: "Défauts éventuels", icon: "alert-circle" },
    ],
  },
  animaux: {
    minPhotos: 2,
    maxPhotos: 6,
    extraLabel: "Photos supplémentaires",
    slots: [
      { key: "front", label: "Photo de face", hint: "Bien visible", icon: "paw", required: true },
      { key: "body", label: "Photo en pied", icon: "paw-outline" },
      { key: "detail", label: "Détails", icon: "search" },
    ],
  },
  "materiel-pro": {
    minPhotos: 3,
    maxPhotos: 12,
    extraLabel: "Photos supplémentaires",
    slots: [
      { key: "front", label: "Vue principale", icon: "construct", required: true },
      { key: "side", label: "Vue de côté", icon: "swap-horizontal" },
      { key: "detail", label: "Détails", hint: "Cabine, commandes", icon: "search" },
      { key: "engine", label: "Moteur", icon: "settings" },
      { key: "hours", label: "Compteur heures", icon: "time" },
    ],
  },
  emploi: {
    minPhotos: 0,
    maxPhotos: 4,
    extraLabel: "Photos (optionnel)",
    slots: [
      { key: "company", label: "Logo entreprise", icon: "business" },
      { key: "workplace", label: "Lieu de travail", icon: "location" },
    ],
  },
  services: {
    minPhotos: 1,
    maxPhotos: 6,
    extraLabel: "Photos supplémentaires",
    slots: [
      { key: "main", label: "Photo principale", icon: "image", required: true },
      { key: "portfolio", label: "Réalisations", icon: "albums" },
    ],
  },
};

const DEFAULT_TEMPLATE: PhotoTemplate = {
  minPhotos: 1,
  maxPhotos: 8,
  extraLabel: "Photos supplémentaires",
  slots: [
    { key: "front", label: "Vue principale", icon: "image", required: true },
    { key: "side", label: "Autre angle", icon: "image-outline" },
    { key: "detail", label: "Détails", icon: "search" },
  ],
};

export function getPhotoTemplate(categoryId: string | null | undefined): PhotoTemplate {
  if (!categoryId) return DEFAULT_TEMPLATE;
  return TEMPLATES[categoryId] ?? DEFAULT_TEMPLATE;
}

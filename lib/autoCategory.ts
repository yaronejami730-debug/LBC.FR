/**
 * Détection automatique de catégorie basée sur l'AdClassifier v2.0
 * Utilise categories-classifier.json (5 006 termes, 12 catégories, 46 sous-catégories)
 */

import { AdClassifier } from "./classifier";
import categoriesData from "./categories-classifier.json";

// ─────────────────────────────────────────────────────────────
// Mapping JSON → IDs de l'application
// ─────────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, { id: string; subcategories: Record<string, string> }> = {
  VEHICULES: {
    id: "vehicules",
    subcategories: {
      "Voitures":       "Voitures",
      "Motos":          "Motos",
      "Utilitaires":    "Utilitaires",
      "Caravaning":     "Caravaning",
      "Nautisme":       "Utilitaires",
      "Equipement Auto":"Équipements auto",
    },
  },
  IMMOBILIER: {
    id: "immobilier",
    subcategories: {
      "Ventes immobilières": "Ventes immobilières",
      "Locations":           "Locations",
      "Colocations":         "Colocations",
      "Bureaux et Commerces":"Bureaux & commerces",
      "Terrains":            "Ventes immobilières",
    },
  },
  EMPLOI: {
    id: "emploi",
    subcategories: {
      "Offres d'emploi": "Offres d'emploi",
      "Formation":        "Offres d'emploi",
    },
  },
  MODE: {
    id: "mode",
    subcategories: {
      "Vêtements femme":        "Vêtements",
      "Vêtements homme":        "Vêtements",
      "Chaussures":             "Chaussures",
      "Accessoires et Bagagerie":"Accessoires & bagagerie",
      "Montres et Bijoux":      "Montres & bijoux",
    },
  },
  ELECTRONIQUE: {
    id: "multimedia",
    subcategories: {
      "Téléphones et Tablettes": "Téléphonie",
      "Informatique":            "Informatique",
      "Consoles et Jeux vidéo":  "Consoles & jeux vidéo",
      "Image et Son":            "Image & son",
    },
  },
  MAISON: {
    id: "maison",
    subcategories: {
      "Ameublement":   "Ameublement",
      "Electroménager":"Électroménager",
      "Décoration":    "Décoration",
      "Bricolage":     "Bricolage",
      "Jardinage":     "Jardinage",
    },
  },
  LOISIRS: {
    id: "loisirs",
    subcategories: {
      "Sport":                 "Sports & hobbies",
      "Instruments de musique":"Musique / Instruments",
      "Livres":                "Livres",
      "Jeux et Jouets":        "Jeux & jouets",
      "Voyages et Billetterie":"DVD / Films",
    },
  },
  ANIMAUX: {
    id: "animaux",
    subcategories: {
      "Chiens":              "Animaux",
      "Chats":               "Animaux",
      "Autres animaux":      "Animaux",
      "Accessoires animaux": "Accessoires pour animaux",
    },
  },
  SERVICES: {
    id: "services",
    subcategories: {
      "Cours particuliers":              "Cours particuliers",
      "Artisans et Services à domicile": "Services à la personne",
      "Covoiturage et Transport":        "Services divers",
      "Événements":                      "Événementiel",
    },
  },
  MATERIEL_PROFESSIONNEL: {
    id: "materiel-pro",
    subcategories: {
      "BTP et Construction":        "BTP / chantier",
      "Restauration professionnelle":"Restauration",
      "Agriculture":                "Agriculture",
    },
  },
  BEBE_ENFANT: {
    id: "bebe-enfant",
    subcategories: {
      "Puériculture":    "Puériculture",
      "Vêtements enfant":"Vêtements enfant",
    },
  },
  VACANCES: {
    id: "vacances",
    subcategories: {
      "Locations saisonnières": "Locations saisonnières",
    },
  },
};

// ─────────────────────────────────────────────────────────────
// Singleton — construit une seule fois au démarrage du module
// ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const classifier = new AdClassifier(categoriesData as any);

// ─────────────────────────────────────────────────────────────
// API publique
// ─────────────────────────────────────────────────────────────

export type DetectResult = { categoryId: string; subcategory: string; confidence: number };

export function detectCategory(title: string, description = ""): DetectResult | null {
  if (!title || title.trim().length < 3) return null;

  const result = classifier.classify(title, description);
  if (!result.success || !result.category || !result.subcategory) return null;

  const catMap = CATEGORY_MAP[result.category];
  if (!catMap) return null;

  const appSubcategory = catMap.subcategories[result.subcategory];
  if (!appSubcategory) return null;

  return {
    categoryId:  catMap.id,
    subcategory: appSubcategory,
    confidence:  result.confidence,
  };
}

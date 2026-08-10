/**
 * Détection automatique de catégorie basée sur l'AdClassifier v2.0
 * Utilise categories-classifier.json (13 catégories, 55 sous-catégories)
 */

import { AdClassifier } from "./classifier";
import { classifyWellness } from "./wellness/classify";
import categoriesData from "./categories-classifier.json";
import { expandAbbreviations } from "./normalize-fr";
import { stripCities } from "./listing-engine/gazetteer";

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

  // La rubrique « Beauté & Bien-être » a son propre moteur : il connaît le
  // niveau 3 (type d'annonce) et distingue une prestation d'une location de
  // cabine entre professionnels, ce que des mots-clés à plat ne savent pas
  // faire. Il passe en premier, sinon « cabine de massage à louer » finirait
  // en immobilier et « coiffeur à domicile » en services à la personne.
  const wellness = classifyWellness({ title, description });
  if (wellness && wellness.offerKind !== "vente_produit" && wellness.confidence >= 0.6) {
    return {
      categoryId: "beaute-bien-etre",
      subcategory: wellness.subcategory,
      confidence: wellness.confidence,
    };
  }

  /**
   * Neutralisation des toponymes avant scoring.
   *
   * Sans elle, 24 des 154 villes de `lib/cities.ts` décidaient seules d'une
   * catégorie, uniquement par correspondance approximative : « Lyon » → « Leon »
   * (modèle Seat), « Fort-de-France » → « Ford », « Nice » → « Nike ». Deux
   * d'entre elles sortaient en catégorie Véhicules — c'est le bug « ville →
   * utilitaire » rapporté par les utilisateurs.
   *
   * Une ville n'est jamais une preuve de catégorie. Aucune règle nominative
   * n'est écrite ici : on retire les entités reconnues, c'est tout.
   *
   * Le moteur de remplacement (`lib/listing-engine/`) fait cela nativement ;
   * ce garde-fou protège le chemin de publication en attendant la bascule.
   */
  const result = classifier.classify(
    expandAbbreviations(stripCities(title).text),
    expandAbbreviations(stripCities(description).text),
  );
  if (!result.success || !result.category || !result.subcategory) return null;

  /**
   * Une correspondance approximative ne prouve rien à elle seule. « brive » à un
   * caractère de « bride » n'est pas une annonce d'équitation. Il faut au moins
   * une preuve exacte pour retenir une catégorie.
   */
  const hasExactEvidence = result.matches.some((m) => m.source !== "fuzzy");
  if (!hasExactEvidence) return null;

  /**
   * Deux catégories au coude à coude ne se départagent pas en silence.
   *
   * `AdClassifier` tranche les égalités par un ordre de priorité fixe, où
   * VEHICULES est premier : « Canapé cuir » — « canapé » pour Maison, « cuir »
   * pour Voitures — sortait donc en véhicule. Ce n'est pas une décision, c'est
   * un tirage au sort déguisé. Sans marge suffisante, on préfère ne rien
   * suggérer : le formulaire demandera.
   */
  const runnerUp = result.alternatives.find((a) => a.category !== result.category);
  if (runnerUp && runnerUp.score > result.score * 0.85) return null;

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

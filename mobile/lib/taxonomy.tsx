import { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "./api";
import {
  CATEGORIES as FALLBACK_CATEGORIES,
  CONDITIONS as FALLBACK_CONDITIONS,
  WELLNESS_CATEGORY_ID,
  type Category,
} from "./categories";

export type WellnessOption = { value: string; label: string };

export type WellnessConfig = {
  categoryId: string;
  durations: WellnessOption[];
  priceUnits: WellnessOption[];
  tariffTypes: WellnessOption[];
  places: string[];
  onePerListingNotice: string;
  maxServices: number;
  maxForIndividuals: number;
  proThreshold: number;
};

/**
 * Régime de champs — miroir de `FieldSetSpec` du site (lib/offer-fields.ts).
 * Servi par /api/taxonomy : un champ ajouté au site apparaît dans l'app sans
 * passer par l'App Store.
 */
export type ExtraField = {
  id: string;
  label: string;
  type: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
  suffix?: string;
  required?: boolean;
};

export type FieldSetSpec = {
  id: string;
  label: string;
  lexicon: string;
  core: Record<string, boolean>;
  extra: ExtraField[];
  labels: { descriptionStep: string; price: string; titleHint: string; noun: string };
};

export type Taxonomy = {
  categories: Category[];
  conditions: string[];
  wellness: WellnessConfig;
  fieldSets: Record<string, FieldSetSpec>;
};

const CACHE_KEY = "taxonomy.v2";

/**
 * Repli embarqué. Utilisé au tout premier lancement et hors ligne ; remplacé
 * dès que /api/taxonomy répond, pour que l'app suive le site sans nouvelle
 * version.
 */
/**
 * Repli minimal des régimes : de quoi ne pas demander l'état d'une prestation
 * hors ligne. Le serveur en sert bien davantage (location, emploi, événement) ;
 * les embarquer tous ici recréerait la duplication qu'on cherche à éviter.
 */
const FALLBACK_FIELD_SETS: Record<string, FieldSetSpec> = {
  bien: {
    id: "bien",
    label: "Objet à vendre",
    lexicon: "objet",
    core: { condition: true, brand: true, model: true, year: true, vehicle: false, immo: false, serviceDetails: false, serviceCard: false },
    extra: [],
    labels: {
      descriptionStep: "Description & état",
      price: "Prix (€)",
      titleHint: "Décrivez l'objet : marque, modèle, état.",
      noun: "annonce",
    },
  },
  prestation: {
    id: "prestation",
    label: "Prestation",
    lexicon: "prestation",
    core: { condition: false, brand: false, model: false, year: false, vehicle: false, immo: false, serviceDetails: true, serviceCard: false },
    extra: [],
    labels: {
      descriptionStep: "Description de la prestation",
      price: "Tarif (€)",
      titleHint: "Dites ce que vous faites, où, et pour quel tarif.",
      noun: "prestation",
    },
  },
  "prestation-bien-etre": {
    id: "prestation-bien-etre",
    label: "Prestation bien-être",
    lexicon: "prestation",
    core: { condition: false, brand: false, model: false, year: false, vehicle: false, immo: false, serviceDetails: true, serviceCard: true },
    extra: [],
    labels: {
      descriptionStep: "Description de la prestation",
      price: "Tarif (€)",
      titleHint: "Le soin, sa durée, le lieu, ce que le tarif couvre.",
      noun: "prestation",
    },
  },
};

export const FALLBACK_TAXONOMY: Taxonomy = {
  categories: FALLBACK_CATEGORIES,
  conditions: FALLBACK_CONDITIONS,
  fieldSets: FALLBACK_FIELD_SETS,
  wellness: {
    categoryId: WELLNESS_CATEGORY_ID,
    durations: [
      { value: "30", label: "30 min" },
      { value: "45", label: "45 min" },
      { value: "60", label: "1 h" },
      { value: "90", label: "1 h 30" },
      { value: "120", label: "2 h" },
      { value: "240", label: "Demi-journée" },
      { value: "480", label: "Journée" },
    ],
    priceUnits: [
      { value: "seance", label: "La séance" },
      { value: "heure", label: "De l'heure" },
      { value: "personne", label: "Par personne" },
      { value: "demi_journee", label: "La demi-journée" },
      { value: "journee", label: "La journée" },
      { value: "mois", label: "Par mois" },
    ],
    tariffTypes: [
      { value: "fixe", label: "Prix fixe" },
      { value: "par_heure", label: "Prix / heure" },
      { value: "par_personne", label: "Prix / personne" },
      { value: "par_seance", label: "Prix / séance" },
      { value: "a_partir_de", label: "À partir de" },
      { value: "forfait", label: "Forfait" },
    ],
    places: ["En institut", "À domicile", "Les deux"],
    onePerListingNotice:
      "Une annonce = une prestation. Vous en proposez plusieurs ? Passez en compte professionnel et présentez votre carte complète sur une seule fiche.",
    maxServices: 20,
    maxForIndividuals: 5,
    proThreshold: 4,
  },
};

const TaxonomyContext = createContext<Taxonomy>(FALLBACK_TAXONOMY);

/** Référentiel courant : cache local d'abord, réponse serveur ensuite. */
export function TaxonomyProvider({ children }: { children: React.ReactNode }) {
  const [taxonomy, setTaxonomy] = useState<Taxonomy>(FALLBACK_TAXONOMY);

  useEffect(() => {
    let cancelled = false;

    // 1. Cache disque — évite de repartir du repli embarqué à chaque lancement.
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const cached = JSON.parse(raw) as Taxonomy;
        if (cached?.categories?.length && cached.fieldSets) setTaxonomy(cached);
      })
      .catch(() => {});

    // 2. Serveur — fait foi.
    apiFetch<Taxonomy>("/api/taxonomy", { auth: false })
      .then((fresh) => {
        if (cancelled || !fresh?.categories?.length) return;
        // Un serveur antérieur au moteur d'intention ne renvoie pas les régimes.
        if (!fresh.fieldSets) fresh.fieldSets = FALLBACK_FIELD_SETS;
        setTaxonomy(fresh);
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh)).catch(() => {});
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  return <TaxonomyContext.Provider value={taxonomy}>{children}</TaxonomyContext.Provider>;
}

export function useTaxonomy(): Taxonomy {
  return useContext(TaxonomyContext);
}

/** Catégorie par libellé — tolère les variantes d'espaces et de casse. */
export function findCategoryByLabel(categories: Category[], label: string | null | undefined) {
  if (!label) return null;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const target = norm(label);
  return categories.find((c) => norm(c.label) === target) ?? null;
}

export function useWellness() {
  const { wellness } = useTaxonomy();
  return useMemo(() => wellness, [wellness]);
}

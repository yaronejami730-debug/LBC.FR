/**
 * Reconnaissance d'entités — villes, marques, modèles.
 *
 * Étape 1 du pipeline (`docs/02-classification.md` §3), et le cœur du
 * correctif : **une ville n'est jamais une preuve de catégorie**. Elle est
 * retirée du sac de mots lexical avant tout scoring, et ne subsiste que comme
 * prior de marché.
 *
 * L'audit a mesuré le coût de son absence : sur les 154 villes de
 * `lib/cities.ts`, 24 produisaient une catégorie à elles seules, uniquement par
 * correspondance approximative — « Lyon » → « Leon » (Seat), « Fort-de-France »
 * → « Ford », « Nice » → « Nike ». Deux d'entre elles sortaient littéralement
 * en catégorie Véhicules : c'est le bug rapporté.
 *
 * Les marques et modèles, eux, sont retirés du sac lexical mais **promus en
 * preuve typée** : « Twingo » est un nom-tête de voiture, pas un mot ordinaire.
 * C'est ce que dit la note du cas de test « Loue Twingo 35€/jour Cannes ».
 */

import { FRENCH_CITIES } from "@/lib/cities";
import { CAR_BRANDS } from "@/lib/carBrands";
import lexicon from "@/data/listing-engine/classifier.lexicon.json";

// ─────────────────────────────────────────────────────────────
// Villes
// ─────────────────────────────────────────────────────────────

export type CityHit = {
  name: string;
  /** 0–1. Sert à ordonner les options d'une question, jamais à choisir. */
  tourismIndex: number;
};

type GazetteerEntry = { name: string; tourism_index?: number };

const PACK_GAZETTEER = (
  (lexicon as { city_gazetteer_sample?: { entries?: GazetteerEntry[] } }).city_gazetteer_sample
    ?.entries ?? []
).reduce<Record<string, number>>((acc, e) => {
  acc[fold(e.name)] = e.tourism_index ?? 0.3;
  return acc;
}, {});

/**
 * Indice touristique par défaut.
 *
 * Le pack prévoit un gazetteer INSEE de 35 000 communes avec un indice calculé.
 * On ne l'a pas ; en attendant, une ville connue sans indice reçoit une valeur
 * neutre. Conséquence assumée : l'ordre des options d'une question de
 * désambiguïsation est moins fin hors des villes listées. Aucune décision de
 * catégorie n'en dépend — c'est précisément la garantie recherchée.
 */
const DEFAULT_TOURISM_INDEX = 0.3;

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // « € » et « / » sont conservés : les retirer ici effacerait « 400€/mois »
    // avant que les motifs numériques ne puissent le lire.
    .replace(/[^a-z0-9€/²]+/g, " ")
    .trim();
}

/** Villes triées par longueur décroissante : « Saint-Denis » avant « Denis ». */
const CITY_INDEX: { folded: string; name: string; tourismIndex: number }[] = FRENCH_CITIES.map(
  (c) => ({
    folded: fold(c.name),
    name: c.name,
    tourismIndex: PACK_GAZETTEER[fold(c.name)] ?? DEFAULT_TOURISM_INDEX,
  }),
)
  .concat(
    Object.entries(PACK_GAZETTEER)
      .filter(([folded]) => !FRENCH_CITIES.some((c) => fold(c.name) === folded))
      .map(([folded, tourismIndex]) => ({ folded, name: folded, tourismIndex })),
  )
  .sort((a, b) => b.folded.length - a.folded.length);

// ─────────────────────────────────────────────────────────────
// Marques et modèles
// ─────────────────────────────────────────────────────────────

/**
 * Modèles courants du marché français. Le pack prévoit un référentiel de
 * ~30 000 entrées ; cette liste couvre ce qui circule réellement sur le site et
 * les cas de test. Chaque modèle porte la sous-catégorie qu'il désigne — un
 * Master n'est pas une citadine.
 */
const VEHICLE_MODELS: { term: string; sub: string }[] = [
  // Citadines et berlines
  ...["clio", "twingo", "megane", "captur", "kadjar", "scenic", "zoe", "talisman"].map((t) => ({ t, s: "voitures" })),
  ...["208", "308", "3008", "2008", "5008", "508", "108"].map((t) => ({ t, s: "voitures" })),
  ...["c3", "c4", "c5", "ds3", "ds4", "ds7", "berlingo"].map((t) => ({ t, s: "voitures" })),
  ...["golf", "polo", "tiguan", "passat", "touran", "up"].map((t) => ({ t, s: "voitures" })),
  ...["corsa", "astra", "mokka", "fiesta", "focus", "puma", "kuga"].map((t) => ({ t, s: "voitures" })),
  ...["sandero", "duster", "logan", "spring", "jogger"].map((t) => ({ t, s: "voitures" })),
  ...["yaris", "corolla", "rav4", "aygo", "leon", "ibiza", "arona", "ateca"].map((t) => ({ t, s: "voitures" })),
  // Utilitaires — la distinction porte le cas de test « Fourgon Renault Master »
  ...["master", "trafic", "kangoo", "jumper", "jumpy", "boxer", "expert", "partner", "ducato", "transit", "sprinter", "crafter", "vito", "daily"].map((t) => ({ t, s: "utilitaires" })),
].map(({ t, s }) => ({ term: t, sub: s }));

const BRAND_INDEX = CAR_BRANDS.map((b) => fold(b.name)).filter((b) => b.length >= 3);

export type EntityScan = {
  /** Texte débarrassé des entités reconnues — le sac de mots lexical. */
  lexicalText: string;
  cities: CityHit[];
  brands: string[];
  /** Modèles reconnus, avec la sous-catégorie véhicule qu'ils impliquent. */
  models: { term: string; sub: string }[];
};

/**
 * Repère les entités et les retire du texte lexical.
 *
 * L'ordre compte : les entités sont reconnues **avant** l'expansion des
 * abréviations, sinon « Cannes » peut être découpé ou confondu (note explicite
 * de `text_normalization` dans le lexique du pack).
 */
export function scanEntities(text: string): EntityScan {
  let working = ` ${fold(text)} `;

  const cities: CityHit[] = [];
  for (const city of CITY_INDEX) {
    const needle = ` ${city.folded} `;
    if (working.includes(needle)) {
      cities.push({ name: city.name, tourismIndex: city.tourismIndex });
      working = working.split(needle).join(" ");
    }
  }

  const models: { term: string; sub: string }[] = [];
  for (const model of VEHICLE_MODELS) {
    const needle = ` ${model.term} `;
    if (working.includes(needle)) {
      models.push(model);
      working = working.split(needle).join(" ");
    }
  }

  const brands: string[] = [];
  for (const brand of BRAND_INDEX) {
    const needle = ` ${brand} `;
    if (working.includes(needle)) {
      brands.push(brand);
      working = working.split(needle).join(" ");
    }
  }

  return {
    lexicalText: ` ${working.replace(/\s+/g, " ").trim()} `,
    cities,
    brands,
    models,
  };
}

/**
 * Retire les seuls toponymes, en laissant marques et modèles en place.
 *
 * Le classifieur historique (`lib/classifier.ts`) compte les marques et modèles
 * parmi ses mots-clés les plus lourds : les lui retirer le priverait de ses
 * meilleures preuves. Lui, il n'a besoin que d'une chose — ne plus voir les
 * noms de villes.
 */
export function stripCities(text: string): { text: string; cities: CityHit[] } {
  let working = ` ${fold(text)} `;
  const cities: CityHit[] = [];
  for (const city of CITY_INDEX) {
    const needle = ` ${city.folded} `;
    if (working.includes(needle)) {
      cities.push({ name: city.name, tourismIndex: city.tourismIndex });
      working = working.split(needle).join(" ");
    }
  }
  return { text: working.replace(/\s+/g, " ").trim(), cities };
}

/** Indice touristique le plus élevé du texte — ordonne les options d'une question. */
export function tourismPrior(cities: CityHit[]): number {
  return cities.reduce((max, c) => Math.max(max, c.tourismIndex), 0);
}

/**
 * Résolution canonique d'une localisation vers une ville du référentiel.
 *
 * Pourquoi ce fichier existe : trois implémentations coexistaient et se
 * contredisaient.
 *
 *   1. `lib/seo/inventory.ts` comptait par `location.includes(nomVille)` —
 *      une sous-chaîne, donc « 89100 sens » alimentait la ville « Sens », mais
 *      « Vincennes » alimentait aussi « Sens » et « Nice » attrapait « Venice ».
 *   2. Le fil d'Ariane de la page annonce slugifiait le premier segment brut de
 *      `location`. Sur « 59162 Ostricourt » il produisait le lien
 *      `/annonces/immobilier/59162-ostricourt`, qui renvoie 404.
 *   3. La route `/annonces/[categorie]/[...slug]` filtrait sur
 *      `location contains cityLabel`, encore une autre règle.
 *
 * Conséquence mesurée avant correction : 180 annonces sur 213 portaient un fil
 * d'Ariane — visible **et** dans le `BreadcrumbList` JSON-LD — pointant vers une
 * page 404. Chaque lien mort consomme du budget d'exploration et invalide la
 * donnée structurée.
 *
 * Ici, une seule fonction fait autorité. Le sitemap, les compteurs, les routes
 * et le fil d'Ariane l'appellent tous, donc ils ne peuvent plus diverger.
 */

import { FRENCH_CITIES, type FrenchCity } from "@/lib/cities";
import communesDataset from "@/data/geo/communes.json";

/** Normalisation commune : minuscules, sans accent, séparateurs unifiés. */
export function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Index nom normalisé → ville. Construit une fois au chargement du module.
 *
 * Les variantes usuelles sont ajoutées explicitement plutôt que devinées :
 * les arrondissements parisiens, lyonnais et marseillais sont saisis de vingt
 * façons différentes par les vendeurs, et une règle générique produirait des
 * rattachements faux dans les deux sens.
 */
const CITY_BY_TOKEN = new Map<string, FrenchCity>();

for (const city of FRENCH_CITIES) {
  CITY_BY_TOKEN.set(city.slug, city);
  CITY_BY_TOKEN.set(normalizeToken(city.name), city);
}

/** Arrondissements → commune mère. « Paris 15e » est une annonce à Paris. */
const ARRONDISSEMENT_PARENTS: Array<{ slug: string; max: number }> = [
  { slug: "paris", max: 20 },
  { slug: "lyon", max: 9 },
  { slug: "marseille", max: 16 },
];

for (const { slug, max } of ARRONDISSEMENT_PARENTS) {
  const parent = CITY_BY_TOKEN.get(slug);
  if (!parent) continue;
  for (let n = 1; n <= max; n++) {
    for (const suffix of [`${n}`, `${n}e`, `${n}er`, `${n}eme`, `${n}-eme`, `${n}-arrondissement`]) {
      CITY_BY_TOKEN.set(`${slug}-${suffix}`, parent);
    }
  }
}

/**
 * Codes postaux → ville, lus dans le référentiel INSEE / La Poste.
 *
 * ── Ce que faisait la version précédente, et pourquoi c'était faux ────────
 *
 * Elle reconstruisait les codes par déduction : « le code postal d'une grande
 * ville est `departmentCode` suivi de 000 », puis attribuait ce code à la
 * première ville du département rencontrée dans `FRENCH_CITIES` — tableau trié
 * par population décroissante. Les deux moitiés de la règle sont justes prises
 * séparément et fausses ensemble : le code `NN000` appartient à la
 * **préfecture**, qui n'est pas toujours la commune la plus peuplée de son
 * département.
 *
 * Mesuré le 27/08/2026 contre `data/geo/communes.json` : **16 codes sur 16
 * départements concernés étaient attribués à la mauvaise ville**.
 *
 *     68000  Colmar        → attribué à Mulhouse
 *     76000  Rouen         → attribué au Havre
 *     93000  Bobigny       → attribué à Saint-Denis
 *     29000  Quimper       → attribué à Brest
 *     92000  Nanterre      → attribué à Boulogne-Billancourt
 *     …
 *
 * Conséquence observée en production : les deux annonces de Colmar écrites
 * « 180 Rue du Ladhof, 68000 Colmar » étaient rattachées à Mulhouse. La page
 * `/ville/colmar` sur-comptait, `/ville/mulhouse` répondait 404 avec du stock
 * réel, et le fil d'Ariane de ces annonces envoyait le visiteur dans une autre
 * ville — le tout dans le fichier censé être le juge unique du rattachement.
 *
 * ── Ce que fait cette version ────────────────────────────────────────────
 *
 * Elle ne déduit plus rien. `data/geo/communes.json` — déjà présent dans le
 * dépôt, déjà chargé côté serveur par le moteur de recommandation — porte les
 * codes postaux réels de 34 900 communes. On y lit ceux des villes du
 * référentiel, tous leurs codes et pas seulement le `NN000` : Mulhouse récupère
 * ainsi 68100 et 68200, que la règle déductive ignorait complètement.
 *
 * Un code absent du référentiel ne produit toujours aucune ville, donc aucun
 * lien. C'est le comportement voulu : mieux vaut pas de rattachement qu'un
 * rattachement faux.
 */
type CommuneRow = [
  name: string,
  insee: string,
  lat: number,
  lng: number,
  population: number,
  department: string,
];

const COMMUNES = communesDataset.communes as unknown as CommuneRow[];
const POSTAL_TO_COMMUNE = communesDataset.postal as Record<string, number>;

const CITY_BY_POSTCODE = new Map<string, FrenchCity>();

{
  // Clé « nom normalisé | département » : le nom seul ne suffit pas, une
  // trentaine de communes homonymes existent d'un département à l'autre.
  const cityByNameDept = new Map<string, FrenchCity>();
  for (const city of FRENCH_CITIES) {
    cityByNameDept.set(`${normalizeToken(city.name)}|${city.departmentCode}`, city);
  }

  for (const [postcode, communeIndex] of Object.entries(POSTAL_TO_COMMUNE)) {
    const commune = COMMUNES[communeIndex];
    if (!commune) continue;
    const city = cityByNameDept.get(`${normalizeToken(commune[0])}|${commune[5]}`);
    if (city) CITY_BY_POSTCODE.set(postcode, city);
  }
}

for (const [slug, range] of [
  ["paris", { start: 75001, end: 75020 }],
  ["lyon", { start: 69001, end: 69009 }],
  ["marseille", { start: 13001, end: 13016 }],
] as const) {
  const city = CITY_BY_TOKEN.get(slug);
  if (!city) continue;
  for (let code = range.start; code <= range.end; code++) {
    CITY_BY_POSTCODE.set(String(code), city);
  }
}

/** Mots à ignorer quand on découpe une localisation en segments candidats. */
const NOISE = new Set(["france", "cedex", "centre", "ville", "sur", "sous", "les", "le", "la"]);

/**
 * Résout une localisation libre vers une ville du référentiel.
 *
 * Accepte les formes réellement observées en base :
 *   « Rennes », « 35000 Rennes », « rennes  », « Paris 15e »,
 *   « La Croix Verte, Val-d'Oise (95), France », « 89100 sens »
 *
 * Renvoie `null` quand aucune correspondance sûre n'existe. C'est le cas
 * nominal pour une commune hors référentiel (Vaudréching, Lisses…) : mieux vaut
 * pas de lien qu'un lien vers une page inexistante.
 */
export function resolveCity(location: string | null | undefined): FrenchCity | null {
  if (!location) return null;

  // 1. Code postal explicite — le signal le plus fiable quand il est présent.
  const postcode = location.match(/\b(\d{5})\b/)?.[1];
  if (postcode) {
    const byCode = CITY_BY_POSTCODE.get(postcode);
    if (byCode) return byCode;
  }

  // 2. Segments séparés par virgule / parenthèse, puis correspondance exacte.
  //    L'exactitude est la règle : c'est elle qui écarte « Vincennes » → « Sens ».
  const segments = location
    .split(/[,(){}[\]/|]/)
    .map((s) => s.replace(/\b\d{5}\b/g, " ").trim())
    .filter(Boolean);

  for (const segment of segments) {
    const token = normalizeToken(segment);
    if (!token) continue;
    const exact = CITY_BY_TOKEN.get(token);
    if (exact) return exact;
  }

  // 3. Fenêtre glissante sur les mots du premier segment, du plus long au plus
  //    court : « Boulogne Billancourt centre » → « boulogne-billancourt ».
  const words = normalizeToken(segments[0] ?? location)
    .split("-")
    .filter((w) => w && !NOISE.has(w));

  for (let size = Math.min(4, words.length); size >= 1; size--) {
    for (let start = 0; start + size <= words.length; start++) {
      const candidate = words.slice(start, start + size).join("-");
      const match = CITY_BY_TOKEN.get(candidate);
      // Un mot isolé de moins de 4 lettres est trop ambigu (« sens », « pau »,
      // « agen » apparaissent dans des adresses sans désigner la commune).
      if (match && (size > 1 || candidate.length >= 4)) return match;
    }
  }

  return null;
}

/**
 * Codes postaux réels d'une ville du référentiel.
 *
 * Sert à préfiltrer en base : `resolveCity` est la seule autorité, mais c'est
 * une fonction TypeScript — SQL ne sait pas l'exécuter. Une requête qui ne
 * cherche que le nom de la commune rate « 45000 » et « 75001 », qui ne
 * contiennent pas le nom. On élargit donc la requête aux codes postaux de la
 * ville, puis on tranche en mémoire avec le juge.
 */
export function postcodesForCity(slug: string): string[] {
  const out: string[] = [];
  for (const [postcode, city] of CITY_BY_POSTCODE) {
    if (city.slug === slug) out.push(postcode);
  }
  return out;
}

/** Slug canonique d'une localisation, ou `null` si la ville est inconnue. */
export function resolveCitySlug(location: string | null | undefined): string | null {
  return resolveCity(location)?.slug ?? null;
}

/** La ville affichée à l'utilisateur, référentiel ou non — jamais un code postal. */
export function displayCity(location: string | null | undefined): string {
  const resolved = resolveCity(location);
  if (resolved) return resolved.name;
  const first = (location ?? "").split(/[,(]/)[0] ?? "";
  return first.replace(/\b\d{5}\b/g, "").trim();
}

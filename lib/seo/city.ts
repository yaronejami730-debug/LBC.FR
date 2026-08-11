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
 * Codes postaux → ville, pour les 157 communes du référentiel.
 *
 * Reconstruit depuis les données existantes : le code postal d'une grande ville
 * est `departmentCode` suivi de « 000 » dans l'immense majorité des cas
 * (Rennes 35000, Colmar 68000). Paris, Lyon et Marseille sont traités à part
 * car leurs arrondissements occupent une plage entière.
 *
 * Ce n'est volontairement pas un référentiel postal complet : on ne rattache
 * que ce dont on est sûr. Un code inconnu ne produit aucune ville, donc aucun
 * lien — ce qui est le comportement voulu.
 */
const CITY_BY_POSTCODE = new Map<string, FrenchCity>();

for (const city of FRENCH_CITIES) {
  const dept = city.departmentCode;
  // Codes à 2 chiffres uniquement (métropole). L'outre-mer utilise 3 chiffres
  // et une numérotation différente : hors périmètre, donc ignoré.
  if (dept.length !== 2) continue;
  const canonical = `${dept}000`;
  if (!CITY_BY_POSTCODE.has(canonical)) CITY_BY_POSTCODE.set(canonical, city);
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

/**
 * Référentiel des communes françaises et résolution d'une localisation libre.
 *
 * Le champ `Listing.location` est une chaîne saisie à la main : « Paris 16e »,
 * « 92200 Neuilly-sur-Seine », « Sens », « 12 rue des Lilas, 75011 Paris ».
 * Le moteur de recommandation a besoin d'un point, pas d'une chaîne.
 *
 * Deux principes gouvernent ce fichier :
 *
 *  1. **Ne jamais inventer.** Quand la saisie est ambiguë (« Saint-Martin »,
 *     porté par 27 communes réparties sur tout le territoire) et qu'aucun
 *     indice — code postal, département — ne tranche, on renvoie `null`. Une
 *     localisation fausse envoie une maison de Sens à un habitant de Bayonne ;
 *     une localisation absente ne fait rien du tout. Le second échec est
 *     infiniment préférable au premier.
 *
 *  2. **Dire à quel point on est sûr.** Un point issu d'un code INSEE exact et
 *     un point issu du centroïde d'un département n'ont pas la même valeur.
 *     `precision` porte cette différence jusqu'au scoring, qui refuse les
 *     points trop grossiers pour un rayon de 20 km.
 *
 * Le jeu de données est régénéré par `scripts/build-communes-dataset.ts`.
 */

import raw from "@/data/geo/communes.json";
import type { GeoPoint } from "./distance";

type Row = [
  name: string,
  insee: string,
  lat: number,
  lng: number,
  population: number,
  department: string,
];

const COMMUNES = raw.communes as unknown as Row[];
const POSTAL_INDEX = raw.postal as Record<string, number>;

/**
 * Finesse du point obtenu, du plus précis au plus grossier.
 *
 * `DEPARTMENT` est volontairement inutilisable pour un rayon de 20 km : un
 * département fait 70 km de large en moyenne. On le conserve quand même parce
 * qu'il permet d'exclure franchement (Lyon ≠ Paris) sans prétendre localiser.
 */
export type GeoPrecision = "COMMUNE" | "POSTAL" | "DEPARTMENT";

export type ResolvedLocation = GeoPoint & {
  /** Nom officiel de la commune (ou du département en repli). */
  city: string;
  /** Code INSEE, vide pour un repli départemental. */
  insee: string;
  department: string;
  postalCode: string | null;
  precision: GeoPrecision;
  /** 0 → 1. Multiplicateur appliqué au score géographique. */
  confidence: number;
};

const PRECISION_CONFIDENCE: Record<GeoPrecision, number> = {
  COMMUNE: 1,
  POSTAL: 0.9,
  DEPARTMENT: 0.35,
};

// ─────────────────────────────────────────────────────────────
// NORMALISATION
// ─────────────────────────────────────────────────────────────

export function normalizePlace(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Variantes d'écriture d'un même nom de commune.
 *
 * « St-Étienne » et « Saint-Etienne » désignent la même ville, et personne ne
 * tape « L'Haÿ-les-Roses » avec son article. Sans ces alias, un tiers des
 * saisies réelles ne trouveraient rien.
 */
function aliases(normalized: string): string[] {
  const out = new Set<string>([normalized]);

  const expanded = normalized
    .replace(/\bst\b/g, "saint")
    .replace(/\bste\b/g, "sainte")
    .replace(/\bsts\b/g, "saints");
  out.add(expanded);

  for (const form of [...out]) {
    const withoutArticle = form.replace(/^(l|le|la|les|d|de|du|des) /, "");
    if (withoutArticle && withoutArticle !== form) out.add(withoutArticle);
  }

  return [...out];
}

// ─────────────────────────────────────────────────────────────
// INDEX (construits une fois, à la première résolution)
// ─────────────────────────────────────────────────────────────

type Indexes = {
  byName: Map<string, number[]>;
  departmentCentroid: Map<string, GeoPoint & { population: number }>;
};

let indexes: Indexes | null = null;

function getIndexes(): Indexes {
  if (indexes) return indexes;

  const byName = new Map<string, number[]>();
  const deptAccumulator = new Map<string, { lat: number; lng: number; pop: number }>();

  COMMUNES.forEach((row, i) => {
    const [name, , lat, lng, population, department] = row;

    for (const alias of aliases(normalizePlace(name))) {
      const bucket = byName.get(alias);
      if (bucket) bucket.push(i);
      else byName.set(alias, [i]);
    }

    // Centroïde départemental pondéré par la population : le barycentre des
    // habitants, pas celui de la surface. Pour le Var, ça place le point vers
    // Toulon plutôt qu'au milieu du massif des Maures, où personne ne vit.
    const acc = deptAccumulator.get(department) ?? { lat: 0, lng: 0, pop: 0 };
    const weight = Math.max(1, population);
    acc.lat += lat * weight;
    acc.lng += lng * weight;
    acc.pop += weight;
    deptAccumulator.set(department, acc);
  });

  const departmentCentroid = new Map<string, GeoPoint & { population: number }>();
  for (const [dept, acc] of deptAccumulator) {
    departmentCentroid.set(dept, {
      lat: acc.lat / acc.pop,
      lng: acc.lng / acc.pop,
      population: acc.pop,
    });
  }

  indexes = { byName, departmentCentroid };
  return indexes;
}

// ─────────────────────────────────────────────────────────────
// RÉSOLUTION
// ─────────────────────────────────────────────────────────────

function toResolved(
  index: number,
  precision: GeoPrecision,
  postalCode: string | null,
): ResolvedLocation {
  const [name, insee, lat, lng, , department] = COMMUNES[index];
  return {
    lat,
    lng,
    city: name,
    insee,
    department,
    postalCode,
    precision,
    confidence: PRECISION_CONFIDENCE[precision],
  };
}

/** Département déduit d'un code postal — « 75011 » → « 75 », « 20190 » → « 2A ». */
function departmentFromPostal(cp: string): string {
  if (cp.startsWith("97") || cp.startsWith("98")) return cp.slice(0, 3);
  if (cp.startsWith("20")) return Number(cp) < 20200 ? "2A" : "2B";
  return cp.slice(0, 2);
}

/**
 * « Paris 16e », « Lyon 3ème », « Marseille 8 » → le code INSEE de
 * l'arrondissement municipal, qui existe comme commune à part entière dans le
 * référentiel (75116, 69383, 13208).
 */
function arrondissementInsee(text: string): string | null {
  const bases: Record<string, [number, number]> = {
    paris: [75100, 20],
    lyon: [69380, 9],
    marseille: [13200, 16],
  };
  const match = text.match(/\b(paris|lyon|marseille)\s+(\d{1,2})\s*(?:er|eme|e|ere)?\b/);
  if (!match) return null;
  const [, city, num] = match;
  const [base, max] = bases[city];
  const n = Number(num);
  if (n < 1 || n > max) return null;
  // Paris est le seul cas où l'INSEE ne suit pas le code postal : le 16e a deux
  // codes postaux (75016 et 75116) mais un seul code commune, 75116.
  return String(city === "paris" ? 75100 + n : base + n);
}

const byInsee = new Map<string, number>();
function findByInsee(insee: string): number | undefined {
  if (byInsee.size === 0) {
    COMMUNES.forEach((row, i) => byInsee.set(row[1], i));
  }
  return byInsee.get(insee);
}

/**
 * Cherche, dans des fragments de texte, la plus longue suite de mots désignant
 * une commune du département donné.
 *
 * Les suites sont essayées de la plus longue à la plus courte : « Saint Jean de
 * Luz » doit gagner contre « Saint Jean », qui existe aussi. À égalité de
 * longueur, la commune la plus peuplée l'emporte — c'est le pari le moins
 * mauvais, et l'écart reste borné par le département.
 */
function findCommuneWithin(
  fragments: string[],
  department: string,
  byName: Map<string, number[]>,
): number | null {
  for (let size = 5; size >= 1; size--) {
    let best: number | null = null;

    for (const fragment of fragments) {
      const words = fragment.split(" ").filter(Boolean);
      if (words.length < size) continue;

      for (let start = 0; start + size <= words.length; start++) {
        const gram = words.slice(start, start + size).join(" ");
        // Un mot isolé de moins de quatre lettres ne discrimine rien : « Le »,
        // « Sud », « Bas » produiraient des rapprochements arbitraires.
        if (size === 1 && gram.length < 4) continue;

        for (const alias of aliases(gram)) {
          for (const i of byName.get(alias) ?? []) {
            if (COMMUNES[i][5] !== department) continue;
            if (best === null || COMMUNES[i][4] > COMMUNES[best][4]) best = i;
          }
        }
      }
    }

    if (best !== null) return best;
  }
  return null;
}

/**
 * Transforme une localisation libre en point géographique, ou `null` si la
 * saisie ne permet pas de trancher.
 *
 * L'ordre des tentatives va du plus sûr au moins sûr :
 *   1. arrondissement municipal explicite ;
 *   2. nom de commune désambiguïsé par un code postal ou un département ;
 *   3. nom de commune sans homonyme gênant ;
 *   4. code postal seul ;
 *   5. département seul (précision `DEPARTMENT`, inutilisable en rayon court).
 */
export function resolveLocation(input: string | null | undefined): ResolvedLocation | null {
  const value = (input ?? "").trim();
  if (!value) return null;

  const { byName, departmentCentroid } = getIndexes();
  const normalized = normalizePlace(value);

  // Indices numériques : code postal (5 chiffres) et département entre
  // parenthèses — « Neuilly-sur-Seine (92) ».
  const postalMatch = value.match(/\b(\d{5})\b/);
  const postalCode = postalMatch ? postalMatch[1] : null;
  const parenDept = value.match(/\((\d{2}[ABab]?|\d{3})\)/);
  const departmentHint = postalCode
    ? departmentFromPostal(postalCode)
    : parenDept
      ? parenDept[1].toUpperCase()
      : null;

  // 1. Arrondissement municipal.
  const arrInsee = arrondissementInsee(normalized);
  if (arrInsee) {
    const idx = findByInsee(arrInsee);
    if (idx !== undefined) return toResolved(idx, "COMMUNE", postalCode);
  }

  // 2 & 3. Nom de commune. On teste chaque fragment séparé par une virgule,
  // du plus spécifique au plus général, puis la chaîne entière débarrassée de
  // ses chiffres — « 75011 Paris » doit trouver « paris ».
  const fragments = [
    ...value.split(","),
    value,
  ]
    .map((f) => normalizePlace(f).replace(/\b\d+\b/g, " ").replace(/\s+/g, " ").trim())
    .filter((f) => f.length >= 2);

  const candidates = new Map<number, void>();
  for (const fragment of fragments) {
    for (const alias of aliases(fragment)) {
      for (const i of byName.get(alias) ?? []) candidates.set(i, undefined);
    }
  }

  if (candidates.size > 0) {
    const list = [...candidates.keys()];

    // Un indice départemental tranche immédiatement.
    if (departmentHint) {
      const inDept = list.filter((i) => COMMUNES[i][5] === departmentHint);
      if (inDept.length === 1) return toResolved(inDept[0], "COMMUNE", postalCode);
      if (inDept.length > 1) {
        // Plusieurs homonymes dans le même département : on prend la plus
        // peuplée, l'erreur restant contenue dans le département.
        const best = inDept.sort((a, b) => COMMUNES[b][4] - COMMUNES[a][4])[0];
        return toResolved(best, "COMMUNE", postalCode);
      }
    }

    if (list.length === 1) return toResolved(list[0], "COMMUNE", postalCode);

    // Homonymes sans indice. On ne tranche que si l'une écrase les autres :
    // « Saint-Denis » sans département reste ambigu et doit échouer, tandis que
    // « Bordeaux » (une commune de 260 000 habitants contre une de 400) ne
    // trompe personne.
    const sorted = list.sort((a, b) => COMMUNES[b][4] - COMMUNES[a][4]);
    const totalPopulation = sorted.reduce((sum, i) => sum + COMMUNES[i][4], 0);
    const topPopulation = COMMUNES[sorted[0]][4];
    if (totalPopulation > 0 && topPopulation / totalPopulation >= 0.8) {
      return toResolved(sorted[0], "COMMUNE", postalCode);
    }
  }

  // 3 bis. Nom de commune noyé dans un libellé de quartier.
  //
  // « Rennes Nord, Ille-et-Vilaine (35), France » ne correspond à aucune
  // commune prise en bloc, mais contient le nom d'une commune du département
  // indiqué. On cherche donc la plus longue suite de mots qui désigne une
  // commune *de ce département* — la contrainte départementale est ce qui rend
  // la recherche sûre : sans elle, « Sud » ou « Centre » ramèneraient n'importe
  // quel homonyme à l'autre bout du pays.
  if (departmentHint) {
    const found = findCommuneWithin(fragments, departmentHint, byName);
    if (found !== null) return toResolved(found, "COMMUNE", postalCode);
  }

  // 4. Code postal seul.
  if (postalCode && POSTAL_INDEX[postalCode] !== undefined) {
    return toResolved(POSTAL_INDEX[postalCode], "POSTAL", postalCode);
  }

  // 5. Département seul. Assez pour exclure, pas pour recommander.
  if (departmentHint) {
    const centroid = departmentCentroid.get(departmentHint);
    if (centroid) {
      return {
        lat: centroid.lat,
        lng: centroid.lng,
        city: `Département ${departmentHint}`,
        insee: "",
        department: departmentHint,
        postalCode,
        precision: "DEPARTMENT",
        confidence: PRECISION_CONFIDENCE.DEPARTMENT,
      };
    }
  }

  return null;
}

/** Nombre de communes chargées — utilisé par les tests et les scripts. */
export function communeCount(): number {
  return COMMUNES.length;
}

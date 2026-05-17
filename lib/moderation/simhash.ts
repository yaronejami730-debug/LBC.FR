/**
 * SimHash 64-bit — détection de duplication / quasi-duplication scalable.
 *
 * Pourquoi pas Jaccard : Jaccard est O(n²) (comparaison de toutes les paires).
 * SimHash + LSH transforme la recherche en lookup O(1) par bucket → scale à
 * des milliards d'annonces.
 *
 * Usage :
 *   const h = simhash(normalize(`${titre} ${description}`));
 *   const bands = lshBands(h);            // 4 entiers 16-bit à indexer
 *   // candidats = annonces partageant ≥1 bande → vérifier hammingDistance ≤ 3
 *
 * Représentation : empreinte 64-bit en deux moitiés non signées 32-bit
 * (`hi`, `lo`). Évite BigInt — le projet cible ES2017. Pour le stockage,
 * `hashToHex` produit une chaîne 16 caractères (TEXT en SQL, keyword en
 * OpenSearch).
 */

export type Hash64 = { hi: number; lo: number };

/** FNV-1a 32-bit — hash rapide et non cryptographique, base configurable. */
function fnv1a32(token: string, basis: number): number {
  let h = basis >>> 0;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Hash 64-bit d'un token : deux FNV-1a 32-bit à bases distinctes. */
function hash64(token: string): Hash64 {
  return {
    lo: fnv1a32(token, 0x811c9dc5),
    hi: fnv1a32(token, 0x9dc5811c),
  };
}

/**
 * Découpe un texte en shingles de 3 mots (3-grammes).
 *
 * Les shingles — plutôt que les mots isolés — captent l'ordre : deux annonces
 * avec le même vocabulaire mais réordonné donnent des empreintes différentes.
 */
export function shingles(text: string, k = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < k) return words.length ? [words.join(" ")] : [];
  const out: string[] = [];
  for (let i = 0; i <= words.length - k; i++) {
    out.push(words.slice(i, i + k).join(" "));
  }
  return out;
}

/**
 * Calcule l'empreinte SimHash 64-bit d'un texte (déjà normalisé).
 *
 * Chaque shingle vote sur les 64 bits : bit à 1 dans le hash du shingle → +1,
 * bit à 0 → −1. L'empreinte finale a un 1 sur les positions à somme positive.
 * Conséquence : deux textes proches partagent la plupart des bits.
 */
export function simhash(text: string): Hash64 {
  const grams = shingles(text);
  if (grams.length === 0) return { hi: 0, lo: 0 };

  const counters = new Int32Array(64);
  for (const gram of grams) {
    const { hi, lo } = hash64(gram);
    for (let bit = 0; bit < 32; bit++) {
      counters[bit] += (lo >>> bit) & 1 ? 1 : -1;
      counters[bit + 32] += (hi >>> bit) & 1 ? 1 : -1;
    }
  }

  let lo = 0;
  let hi = 0;
  for (let bit = 0; bit < 32; bit++) {
    if (counters[bit] > 0) lo |= 1 << bit;
    if (counters[bit + 32] > 0) hi |= 1 << bit;
  }
  return { hi: hi >>> 0, lo: lo >>> 0 };
}

/** popcount d'un entier 32-bit (nombre de bits à 1). */
function popcount32(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return (Math.imul(x, 0x01010101) >>> 24) & 0xff;
}

/** Distance de Hamming entre deux empreintes — nombre de bits différents. */
export function hammingDistance(a: Hash64, b: Hash64): number {
  return popcount32(a.hi ^ b.hi) + popcount32(a.lo ^ b.lo);
}

/**
 * Découpe l'empreinte 64-bit en 4 bandes de 16 bits pour l'indexation LSH.
 *
 * Deux empreintes à distance de Hamming ≤ 3 partagent forcément ≥1 bande
 * identique (principe des tiroirs). On indexe les 4 bandes ; une nouvelle
 * annonce ne compare ses candidats qu'aux annonces partageant une bande.
 *
 * Schéma SQL d'indexation : table (band SMALLINT, chunk INT, listing_id BIGINT).
 */
export function lshBands(hash: Hash64): number[] {
  return [
    hash.lo & 0xffff,
    (hash.lo >>> 16) & 0xffff,
    hash.hi & 0xffff,
    (hash.hi >>> 16) & 0xffff,
  ];
}

/** Seuil de quasi-duplication par défaut (bits). ≤ 3 = quasi-identique. */
export const NEAR_DUP_THRESHOLD = 3;

/** true si les deux empreintes désignent un quasi-doublon. */
export function isNearDuplicate(a: Hash64, b: Hash64, threshold = NEAR_DUP_THRESHOLD): boolean {
  return hammingDistance(a, b) <= threshold;
}

/** Sérialise une empreinte en chaîne hexadécimale 16 caractères (stockage). */
export function hashToHex(hash: Hash64): string {
  return hash.hi.toString(16).padStart(8, "0") + hash.lo.toString(16).padStart(8, "0");
}

/** Inverse de `hashToHex`. */
export function hashFromHex(hex: string): Hash64 {
  return {
    hi: parseInt(hex.slice(0, 8), 16) >>> 0,
    lo: parseInt(hex.slice(8, 16), 16) >>> 0,
  };
}

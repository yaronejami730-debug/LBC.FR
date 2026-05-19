/**
 * Arithmétique binaire des empreintes perceptuelles d'images (pHash 64 bits).
 *
 * Module pur — aucune dépendance (ni `sharp`, ni Prisma). Sûr à importer
 * partout. Le calcul du hash lui-même vit dans `image-hash.ts` (a besoin de
 * `sharp`), la recherche de doublons dans `image-dedup.ts` (a besoin de Prisma).
 *
 * Stockage : Postgres `BIGINT` est un entier signé 64 bits. Un pHash est une
 * suite de 64 bits non signés → on convertit en représentation signée avant
 * écriture (`toSignedI64`) et on revient en non signé pour comparer les bits
 * (`toUnsignedI64`). Les distances de Hamming travaillent toujours sur la
 * forme non signée masquée 64 bits.
 *
 * Cible TypeScript du projet = ES2017 → pas de littéraux BigInt (`0n`). On
 * passe par `BigInt(n)`, valable à l'exécution sur Node moderne.
 */

const ZERO = BigInt(0);
const ONE = BigInt(1);
const SIXTYFOUR = BigInt(64);

/** Masque 64 bits. */
export const U64 = (ONE << SIXTYFOUR) - ONE;

/** 2^63 — première valeur du domaine signé négatif. */
const I64_MAX = ONE << BigInt(63);

const TWO_POW_64 = ONE << SIXTYFOUR;

/** pHash non signé (0 … 2^64-1) → entier signé stockable en `BIGINT`. */
export function toSignedI64(hash: bigint): bigint {
  const m = hash & U64;
  return m >= I64_MAX ? m - TWO_POW_64 : m;
}

/** Entier signé relu depuis `BIGINT` → pHash non signé masqué 64 bits. */
export function toUnsignedI64(value: bigint): bigint {
  return value & U64;
}

/** Distance de Hamming entre deux pHash (nombre de bits différents, 0–64). */
export function hammingDistance64(a: bigint, b: bigint): number {
  let x = (a ^ b) & U64;
  let count = 0;
  while (x !== ZERO) {
    x &= x - ONE; // efface le bit de poids faible allumé
    count++;
  }
  return count;
}

const WORD_MASK = BigInt(0xffff);

/**
 * Bandes LSH : découpe le pHash 64 bits en 4 mots de 16 bits.
 *
 * Recherche de quasi-doublon scalable : deux images proches partagent presque
 * sûrement ≥1 bande identique. On indexe les 4 bandes → les candidats sont
 * trouvés par lookup index (`WHERE lshBandK = …`), puis la distance de
 * Hamming exacte est vérifiée en mémoire. Aucun scan de table.
 *
 * Même schéma que la dedup SimHash texte du projet (cohérence).
 */
export function pHashBands(hash: bigint): [number, number, number, number] {
  const h = hash & U64;
  return [
    Number((h >> BigInt(48)) & WORD_MASK),
    Number((h >> BigInt(32)) & WORD_MASK),
    Number((h >> BigInt(16)) & WORD_MASK),
    Number(h & WORD_MASK),
  ];
}

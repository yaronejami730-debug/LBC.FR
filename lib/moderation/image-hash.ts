/**
 * Empreinte perceptuelle d'image — pHash 64 bits (DCT).
 *
 * Pourquoi le pHash : un fraudeur change d'IP, d'email, de téléphone… mais
 * recycle les mêmes photos (voitures, animaux, appartements volés sur d'autres
 * sites). Le pHash est une « empreinte » stable de l'image : il survit au
 * recompression, au redimensionnement et aux petits ajustements de couleur.
 * Deux comptes différents portant la même photo = signal d'arnaque fort.
 *
 * Algorithme (pHash classique) :
 *   1. niveau de gris + redimensionnement 32×32 (supprime couleur et détail)
 *   2. DCT 2D — on ne garde que le bloc 8×8 basses fréquences (structure)
 *   3. seuil = médiane des 64 coefficients (hors composante continue)
 *   4. bit = coefficient > médiane → hash 64 bits
 *
 * Aucune IA : transformée déterministe, explicable, ~1 ms par image.
 */

import sharp from "sharp";
import { U64 } from "@/lib/moderation/phash-bits";

const SIZE = 32;        // résolution de travail
const LOW_FREQ = 8;     // bloc basses fréquences conservé (8×8 = 64 bits)

/** Tables de cosinus précalculées : cos[u][x] pour la DCT-II. */
const COS: number[][] = (() => {
  const t: number[][] = [];
  for (let u = 0; u < LOW_FREQ; u++) {
    t[u] = [];
    for (let x = 0; x < SIZE; x++) {
      t[u][x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * SIZE));
    }
  }
  return t;
})();

/** DCT-II 2D restreinte au bloc 8×8 basses fréquences. */
function dctLowFreq(pixels: Uint8Array): number[] {
  // DCT séparable : d'abord les lignes, puis les colonnes.
  // rows[u][y] = somme_x pixel[x][y] * cos[u][x]
  const rows: number[][] = [];
  for (let u = 0; u < LOW_FREQ; u++) {
    rows[u] = new Array(SIZE).fill(0);
    for (let y = 0; y < SIZE; y++) {
      let s = 0;
      for (let x = 0; x < SIZE; x++) s += pixels[x * SIZE + y] * COS[u][x];
      rows[u][y] = s;
    }
  }
  const coeffs: number[] = [];
  for (let u = 0; u < LOW_FREQ; u++) {
    for (let v = 0; v < LOW_FREQ; v++) {
      let s = 0;
      for (let y = 0; y < SIZE; y++) s += rows[u][y] * COS[v][y];
      coeffs.push(s);
    }
  }
  return coeffs; // 64 valeurs, coeffs[0] = composante continue
}

/** Calcule le pHash 64 bits (non signé) d'un buffer image. */
export async function computePHash(buffer: Buffer): Promise<bigint> {
  const raw = await sharp(buffer)
    .greyscale()
    .resize(SIZE, SIZE, { fit: "fill" })
    .raw()
    .toBuffer();

  const coeffs = dctLowFreq(new Uint8Array(raw));

  // Médiane sur les 63 coefficients hors composante continue (coeffs[0]).
  const sorted = coeffs.slice(1).sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];

  const ZERO = BigInt(0);
  const ONE = BigInt(1);
  let hash = ZERO;
  for (let i = 0; i < 64; i++) {
    hash = (hash << ONE) | (coeffs[i] > median ? ONE : ZERO);
  }
  return hash & U64;
}

export type HashedImage = {
  url: string;
  phash: bigint;            // non signé
  width: number | null;
  height: number | null;
  sizeBytes: number;
};

const FETCH_TIMEOUT_MS = 7000;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

/** Télécharge une image et calcule son pHash. `null` en cas d'échec. */
export async function hashImageUrl(url: string): Promise<HashedImage | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) return null;

    const [meta, phash] = await Promise.all([
      sharp(buf).metadata().catch(() => null),
      computePHash(buf),
    ]);
    return {
      url,
      phash,
      width: meta?.width ?? null,
      height: meta?.height ?? null,
      sizeBytes: buf.length,
    };
  } catch {
    return null; // image injoignable / format illisible — non bloquant
  }
}

/**
 * Hashe une liste d'URLs d'images en parallèle. Plafonné pour borner la
 * latence à la publication (les images au-delà du plafond sont ignorées).
 */
export async function hashImageUrls(urls: string[], cap = 8): Promise<HashedImage[]> {
  const slice = urls
    .filter((u): u is string => typeof u === "string" && u.length > 0)
    .slice(0, cap);
  const results = await Promise.all(slice.map(hashImageUrl));
  return results.filter((r): r is HashedImage => r !== null);
}

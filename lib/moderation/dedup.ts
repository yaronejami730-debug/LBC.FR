/**
 * Détection de duplication d'annonces — recherche LSH persistée.
 *
 * Une annonce porte son empreinte `simhash` (hex) + 4 bandes LSH indexées
 * (`lshBand0..3`). Une nouvelle annonce ne se compare qu'aux annonces
 * partageant ≥1 bande : lookup index O(1) au lieu de O(n) comparaisons.
 *
 * Étapes :
 *   1. candidats = annonces actives partageant une bande LSH
 *   2. vérification exacte = distance de Hamming ≤ seuil
 *   3. signal : duplication cross-compte = arnaque probable (poids fort) ;
 *      duplication même compte = spam (poids moyen).
 */

import type { PrismaClient } from "@prisma/client";
import {
  simhash,
  lshBands,
  hashToHex,
  hashFromHex,
  hammingDistance,
  NEAR_DUP_THRESHOLD,
  type Hash64,
} from "@/lib/moderation/simhash";
import { signal, type SignalHit } from "@/lib/moderation/risk-engine";

export type DuplicateMatch = {
  listingId: string;
  userId: string;
  distance: number;
};

export type DedupResult = {
  hash: Hash64;
  hex: string;
  bands: number[];
  matches: DuplicateMatch[];
  crossUser: boolean;        // au moins un doublon appartient à un autre compte
};

/** Champs d'empreinte à persister sur la nouvelle annonce. */
export function fingerprintFields(text: string): {
  simhash: string;
  lshBand0: number;
  lshBand1: number;
  lshBand2: number;
  lshBand3: number;
} {
  const hash = simhash(text);
  const [b0, b1, b2, b3] = lshBands(hash);
  return { simhash: hashToHex(hash), lshBand0: b0, lshBand1: b1, lshBand2: b2, lshBand3: b3 };
}

/**
 * Recherche les quasi-doublons d'un texte parmi les annonces existantes.
 *
 * @param prisma   client Prisma
 * @param text     texte normalisé (`${titre} ${description}` minuscule)
 * @param ownerId  auteur de la nouvelle annonce — distingue spam vs arnaque
 * @param threshold distance de Hamming max (défaut : 3 bits)
 */
export async function findDuplicates(
  prisma: PrismaClient,
  text: string,
  ownerId: string,
  threshold = NEAR_DUP_THRESHOLD,
): Promise<DedupResult> {
  const hash = simhash(text);
  const bands = lshBands(hash);
  const hex = hashToHex(hash);

  const candidates = await prisma.listing.findMany({
    where: {
      deletedAt: null,
      status: { in: ["APPROVED", "PENDING"] },
      OR: [
        { lshBand0: bands[0] },
        { lshBand1: bands[1] },
        { lshBand2: bands[2] },
        { lshBand3: bands[3] },
      ],
    },
    select: { id: true, userId: true, simhash: true },
    take: 500, // garde-fou : bande sur-peuplée → on plafonne
  });

  const matches: DuplicateMatch[] = [];
  for (const c of candidates) {
    if (!c.simhash) continue;
    const dist = hammingDistance(hash, hashFromHex(c.simhash));
    if (dist <= threshold) {
      matches.push({ listingId: c.id, userId: c.userId, distance: dist });
    }
  }

  return {
    hash,
    hex,
    bands,
    matches,
    crossUser: matches.some((m) => m.userId !== ownerId),
  };
}

/**
 * Convertit un résultat de dedup en signal de risque.
 * Renvoie `null` si aucun doublon.
 */
export function dedupSignal(result: DedupResult): SignalHit | null {
  if (result.matches.length === 0) return null;

  const closest = result.matches.reduce((a, b) => (b.distance < a.distance ? b : a));
  // Distance plus faible = copie plus fidèle = score plus haut.
  const proximity = (NEAR_DUP_THRESHOLD - closest.distance + 1) / (NEAR_DUP_THRESHOLD + 1);

  if (result.crossUser) {
    // Annonce recopiée depuis un autre compte → arnaque probable.
    return signal("dup.crossuser", "scam", Math.round(45 * proximity + 15), {
      matchedListing: closest.listingId,
      distance: closest.distance,
      total: result.matches.length,
    });
  }
  // Republication par le même compte → spam.
  return signal("dup.simhash", "spam", Math.round(30 * proximity), {
    matchedListing: closest.listingId,
    distance: closest.distance,
    total: result.matches.length,
  });
}

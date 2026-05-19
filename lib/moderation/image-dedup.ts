/**
 * Détection de photos recyclées — recherche de doublons perceptuels.
 *
 * Chaque image publiée porte son pHash dans `ListingImage` : `phash` (64 bits)
 * + 4 bandes LSH indexées (`lshBand0..3`, 16 bits chacune).
 *
 * Passage à l'échelle : à la publication, on ne scanne pas la table. Deux
 * images proches partagent presque sûrement ≥1 bande LSH → on récupère les
 * candidats par lookup index (`WHERE lshBandK = …`), puis on vérifie la
 * distance de Hamming exacte en mémoire. Même schéma que la dedup SimHash texte.
 *
 * Signal :
 *   - même photo sur un AUTRE compte  → arnaque probable (poids fort)
 *   - même photo sur le MÊME compte   → republication / spam (poids moyen)
 *
 * Les annonces supprimées sont volontairement incluses : un fraudeur supprime
 * son annonce signalée puis re-poste la photo sur un nouveau compte — c'est
 * précisément le comportement qu'on veut attraper.
 */

import type { PrismaClient } from "@prisma/client";
import { signal, type SignalHit } from "@/lib/moderation/risk-engine";
import {
  hammingDistance64,
  pHashBands,
  toUnsignedI64,
} from "@/lib/moderation/phash-bits";

/**
 * Distance de Hamming maximale considérée comme « même image ».
 * Mesuré : recompression JPEG et redimensionnement dérivent de ~2 bits, deux
 * photos distinctes sont à ≫20 bits. 6 attrape les recyclages (y compris
 * retouche légère) en gardant une marge confortable contre les faux positifs.
 */
export const IMAGE_DUP_THRESHOLD = 6;

export type ImageDupMatch = {
  listingId: string;
  userId: string;
  url: string;
  distance: number;
};

export type ImageDedupResult = {
  matches: ImageDupMatch[];
  crossUser: boolean;        // ≥1 doublon sur un autre compte
  sameUser: boolean;         // ≥1 doublon sur le compte courant
  distinctAccounts: number;  // nb de comptes distincts portant un doublon
};

const EMPTY: ImageDedupResult = {
  matches: [],
  crossUser: false,
  sameUser: false,
  distinctAccounts: 0,
};

/**
 * Cherche les images existantes quasi identiques à celles de la nouvelle annonce.
 *
 * @param prisma   client Prisma
 * @param phashes  pHash NON signés des images de la nouvelle annonce
 * @param ownerId  auteur de la nouvelle annonce — distingue arnaque vs spam
 */
export async function findImageDuplicates(
  prisma: PrismaClient,
  phashes: bigint[],
  ownerId: string,
): Promise<ImageDedupResult> {
  if (phashes.length === 0) return EMPTY;

  // Candidats = images partageant ≥1 bande LSH avec l'une de nos images.
  const band0 = new Set<number>();
  const band1 = new Set<number>();
  const band2 = new Set<number>();
  const band3 = new Set<number>();
  for (const h of phashes) {
    const [b0, b1, b2, b3] = pHashBands(h);
    band0.add(b0);
    band1.add(b1);
    band2.add(b2);
    band3.add(b3);
  }

  const candidates = await prisma.listingImage.findMany({
    where: {
      OR: [
        { lshBand0: { in: [...band0] } },
        { lshBand1: { in: [...band1] } },
        { lshBand2: { in: [...band2] } },
        { lshBand3: { in: [...band3] } },
      ],
    },
    select: {
      url: true,
      phash: true,
      listing: { select: { id: true, userId: true } },
    },
    take: 2000, // garde-fou : bande sur-peuplée → on plafonne
  });

  const matches: ImageDupMatch[] = [];
  for (const c of candidates) {
    if (c.phash == null) continue;
    const candHash = toUnsignedI64(c.phash);
    // Distance minimale à l'une de nos images.
    let best = 64;
    for (const h of phashes) {
      const d = hammingDistance64(h, candHash);
      if (d < best) best = d;
    }
    if (best <= IMAGE_DUP_THRESHOLD) {
      matches.push({
        listingId: c.listing.id,
        userId: c.listing.userId,
        url: c.url,
        distance: best,
      });
    }
  }

  const accounts = new Set(matches.map((m) => m.userId));
  return {
    matches,
    crossUser: matches.some((m) => m.userId !== ownerId),
    sameUser: matches.some((m) => m.userId === ownerId),
    distinctAccounts: accounts.size,
  };
}

/** Convertit un résultat de dedup image en signal de risque. `null` si aucun. */
export function imageDedupSignal(result: ImageDedupResult): SignalHit | null {
  if (result.matches.length === 0) return null;

  const matchedListings = [...new Set(result.matches.map((m) => m.listingId))].slice(0, 10);

  if (result.crossUser) {
    // Photo réutilisée sur d'autres comptes → arnaque probable.
    // Plus le nombre de comptes distincts est élevé, plus le risque monte.
    const score = Math.min(75, 50 + (result.distinctAccounts - 1) * 12);
    return signal("image.dup.crossuser", "scam", score, {
      matchedListings,
      distinctAccounts: result.distinctAccounts,
      minDistance: Math.min(...result.matches.map((m) => m.distance)),
    });
  }

  // Même photo, même compte → republication / spam.
  return signal("image.dup.sameuser", "spam", 22, {
    matchedListings,
    minDistance: Math.min(...result.matches.map((m) => m.distance)),
  });
}

/**
 * Géocodage des annonces — remplissage des colonnes `geo*` de `Listing`.
 *
 * Le géocodage n'est volontairement branché sur aucun chemin de publication.
 * Deux raisons :
 *
 *  - le référentiel des communes pèse 1,8 Mo ; l'embarquer dans la route
 *    publique `POST /api/listings` alourdirait un démarrage à froid déjà sur le
 *    chemin critique de chaque mise en ligne ;
 *  - une annonce dont la localisation n'est pas encore résolue n'est pas cassée,
 *    elle est simplement invisible pour le moteur de recommandation jusqu'au
 *    prochain passage. Rien d'urgent, donc rien à faire en synchrone.
 *
 * Le CRON appelle `resolvePendingListingGeo()` avant chaque campagne, et
 * `scripts/backfill-listing-geo.ts` rattrape l'historique.
 */

import { prisma } from "@/lib/prisma";
import { resolveLocation } from "@/lib/geo/communes";

export type GeoBackfillResult = {
  scanned: number;
  resolved: number;
  unresolved: number;
};

/**
 * Résout les annonces qui n'ont pas encore de coordonnées.
 *
 * Les échecs sont marqués (`geoResolvedAt` renseigné, `geoLat` nul) pour ne pas
 * être réexaminés à chaque passage : une localisation que le référentiel ne sait
 * pas lire aujourd'hui ne deviendra pas lisible demain, sauf si le vendeur
 * corrige son annonce — auquel cas `updatedAt` change et le rattrapage explicite
 * la reprendra.
 */
export async function resolvePendingListingGeo({
  batchSize = 1000,
  maxBatches = 20,
  onlyFresh,
}: {
  batchSize?: number;
  maxBatches?: number;
  /** Limite le travail aux annonces créées après cette date. */
  onlyFresh?: Date;
} = {}): Promise<GeoBackfillResult> {
  let scanned = 0;
  let resolved = 0;
  let unresolved = 0;

  for (let batch = 0; batch < maxBatches; batch++) {
    const rows = await prisma.listing.findMany({
      where: {
        geoResolvedAt: null,
        deletedAt: null,
        ...(onlyFresh ? { createdAt: { gte: onlyFresh } } : {}),
      },
      select: { id: true, location: true },
      take: batchSize,
      orderBy: { createdAt: "desc" },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned++;
      const point = resolveLocation(row.location);
      if (point) resolved++;
      else unresolved++;

      await prisma.listing.update({
        where: { id: row.id },
        data: {
          geoLat: point?.lat ?? null,
          geoLng: point?.lng ?? null,
          geoPrecision: point?.precision ?? null,
          geoCity: point?.city ?? null,
          geoInsee: point?.insee || null,
          geoResolvedAt: new Date(),
        },
      });
    }

    if (rows.length < batchSize) break;
  }

  return { scanned, resolved, unresolved };
}

/**
 * Force la reprise du géocodage sur des annonces déjà traitées — après une mise
 * à jour du référentiel, ou quand un vendeur corrige sa localisation.
 */
export async function invalidateListingGeo(listingIds: string[]): Promise<number> {
  if (listingIds.length === 0) return 0;
  const { count } = await prisma.listing.updateMany({
    where: { id: { in: listingIds } },
    data: { geoResolvedAt: null },
  });
  return count;
}

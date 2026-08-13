/**
 * Distances terrestres — formule de Haversine.
 *
 * Comparer des noms de villes ne suffit pas : « Levallois-Perret » et « Paris »
 * n'ont pas une lettre en commun et sont à 4 km l'un de l'autre, alors que
 * « Saint-Denis » (93) et « Saint-Denis » (La Réunion) portent le même nom et
 * sont séparés par 9 000 km. Le seul arbitre honnête, ce sont les coordonnées.
 */

export type GeoPoint = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distance orthodromique en kilomètres entre deux points. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type BoundingBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

/**
 * Rectangle englobant un disque de `radiusKm` autour d'un point.
 *
 * Sert de pré-filtre SQL : une comparaison `lat BETWEEN … AND lng BETWEEN …`
 * utilise un index B-tree ordinaire, là où Haversine forcerait un balayage
 * complet de la table. Le rectangle est plus large que le disque — on refait
 * donc le calcul exact sur les candidats retenus, jamais l'inverse.
 */
export function boundingBox(center: GeoPoint, radiusKm: number): BoundingBox {
  const latDelta = radiusKm / 111.32;
  // Les méridiens se resserrent vers les pôles ; à Dunkerque un degré de
  // longitude vaut 20 km de moins qu'à Perpignan. Le cosinus corrige ça.
  // Plancher à 0.01 pour éviter une division explosive près des pôles.
  const lngDelta = radiusKm / (111.32 * Math.max(0.01, Math.cos((center.lat * Math.PI) / 180)));

  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

/** Distance arrondie pour affichage : « 4,8 km », « 12 km ». */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 10) / 10}`.replace(".", ",") + " km";
  if (km < 10) return `${Math.round(km * 10) / 10}`.replace(".", ",") + " km";
  return `${Math.round(km)} km`;
}

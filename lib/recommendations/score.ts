/**
 * Scoring de pertinence — la seule fonction qui décide si un compte doit voir
 * une annonce.
 *
 * Elle est volontairement pure : pas de base de données, pas d'horloge cachée,
 * pas d'appel réseau. On lui donne une annonce, une zone et un intérêt, elle
 * rend un score et le détail de son calcul. C'est ce qui permet à la simulation
 * (`dryRun`) de dire exactement pourquoi un compte a été retenu ou écarté, et
 * aux tests de scénarios de vérifier la décision sans monter une base.
 *
 * Le score final est ramené sur 100 pour rester lisible dans l'administration,
 * mais il n'a pas de sens absolu : c'est un classement, pas une probabilité.
 */

import { RECO_CONFIG, USABLE_PRECISIONS } from "./config";
import { distanceKm, type GeoPoint } from "@/lib/geo/distance";

export type ScoredZone = {
  zoneKey: string;
  lat: number;
  lng: number;
  precision: string;
  /** LISTING_PUBLISHED | PROFILE_ADDRESS | SEARCH | LISTING_VIEWED */
  source: string;
  /** CERTAIN | ESTIMATED */
  certainty: string;
  /** 0 → 100 */
  confidence: number;
  isPrimary: boolean;
};

export type ScoredListing = GeoPoint & {
  id: string;
  createdAt: Date;
  geoPrecision: string | null;
};

export type ScoreBreakdown = {
  /** 0 → 100, normalisé. */
  score: number;
  categoryScore: number;
  locationScore: number;
  distanceScore: number;
  recencyScore: number;
  distanceKm: number;
  certainty: string;
  zoneKey: string;
  /** Renseigné quand `score` vaut 0 : dit pourquoi la paire est écartée. */
  rejectedFor?: string;
};

/**
 * Poids d'une zone selon son origine.
 *
 * L'écart entre 40 et 15 n'est pas un réglage esthétique : il traduit une
 * différence de nature. Publier une annonce à Sens, c'est déclarer un lien avec
 * Sens. Consulter des annonces à Sens, c'est peut-être préparer des vacances.
 */
const SOURCE_WEIGHT: Record<string, number> = {
  LISTING_PUBLISHED: 40,
  PROFILE_ADDRESS: 34,
  SEARCH: 22,
  LISTING_VIEWED: 15,
};

/** Barème de distance — décroissant par paliers de 5 km. */
function distanceScoreFor(km: number): number {
  if (km <= 5) return 20;
  if (km <= 10) return 15;
  if (km <= 15) return 10;
  if (km <= RECO_CONFIG.radiusKm) return 5;
  return 0;
}

/** Fraîcheur de l'annonce : une publication d'hier vaut mieux qu'une de mardi dernier. */
function listingRecencyScore(createdAt: Date, now: Date): number {
  const ageHours = (now.getTime() - createdAt.getTime()) / 3_600_000;
  if (ageHours <= 24) return 10;
  if (ageHours <= 72) return 8;
  if (ageHours <= 24 * 7) return 5;
  return 2;
}

const MAX_RAW = 40 + 40 + 20 + 10;

/**
 * Note une paire (annonce, zone) pour un compte dont l'intérêt catégoriel est
 * `categoryInterest` (0 → 100).
 *
 * Rend toujours un objet : un score nul accompagné de `rejectedFor` vaut
 * refus, et sert directement de ligne d'explication en mode simulation.
 */
export function scorePair({
  listing,
  zone,
  categoryInterest,
  now = new Date(),
}: {
  listing: ScoredListing;
  zone: ScoredZone;
  categoryInterest: number;
  now?: Date;
}): ScoreBreakdown {
  const km = distanceKm({ lat: listing.lat, lng: listing.lng }, { lat: zone.lat, lng: zone.lng });

  const base: ScoreBreakdown = {
    score: 0,
    categoryScore: 0,
    locationScore: 0,
    distanceScore: 0,
    recencyScore: 0,
    distanceKm: km,
    certainty: zone.certainty,
    zoneKey: zone.zoneKey,
  };

  // ── Exclusions franches ────────────────────────────────────────────────
  // Elles précèdent tout calcul : additionner des points pour finalement les
  // jeter fabriquerait des scores trompeurs dans les journaux.

  if (!USABLE_PRECISIONS.has(listing.geoPrecision ?? "")) {
    return { ...base, rejectedFor: "annonce sans localisation assez fine" };
  }
  if (!USABLE_PRECISIONS.has(zone.precision)) {
    return { ...base, rejectedFor: "zone utilisateur trop approximative" };
  }
  if (km > RECO_CONFIG.radiusKm) {
    return { ...base, rejectedFor: `hors rayon (${km.toFixed(1)} km)` };
  }
  if (zone.confidence < RECO_CONFIG.minZoneConfidence) {
    return { ...base, rejectedFor: `zone peu fiable (${zone.confidence})` };
  }
  if (categoryInterest < RECO_CONFIG.minCategoryInterest) {
    // Le cas « il habite à côté mais l'immobilier ne l'intéresse pas ».
    return { ...base, rejectedFor: `intérêt catégoriel insuffisant (${categoryInterest})` };
  }

  // ── Points ─────────────────────────────────────────────────────────────

  const categoryScore = Math.round(categoryInterest * 0.4);

  const sourceWeight = SOURCE_WEIGHT[zone.source] ?? SOURCE_WEIGHT.LISTING_VIEWED;
  // La confiance module sans jamais annuler : une zone certaine mais un peu
  // ancienne reste meilleure qu'une zone devinée et fraîche.
  const confidenceFactor = 0.6 + 0.4 * (zone.confidence / 100);
  const primaryFactor = zone.isPrimary ? 1 : 0.85;
  const locationScore = Math.round(sourceWeight * confidenceFactor * primaryFactor);

  const distanceScore = distanceScoreFor(km);
  const recencyScore = listingRecencyScore(listing.createdAt, now);

  const raw = categoryScore + locationScore + distanceScore + recencyScore;
  const score = Math.round((raw / MAX_RAW) * 100);

  return {
    score,
    categoryScore,
    locationScore,
    distanceScore,
    recencyScore,
    distanceKm: km,
    certainty: zone.certainty,
    zoneKey: zone.zoneKey,
    ...(score < RECO_CONFIG.minScore ? { rejectedFor: `score trop bas (${score})` } : {}),
  };
}

/**
 * Meilleure façon de rapprocher une annonce d'un compte qui a plusieurs zones.
 *
 * Quelqu'un qui vit à Paris et possède un garage à Melun a deux zones légitimes
 * et une annonce peut n'être proche que de l'une des deux. On retient la
 * meilleure, jamais la somme : le compte n'est pas « deux fois intéressé ».
 */
export function bestZoneMatch({
  listing,
  zones,
  categoryInterest,
  now,
}: {
  listing: ScoredListing;
  zones: ScoredZone[];
  categoryInterest: number;
  now?: Date;
}): ScoreBreakdown | null {
  let best: ScoreBreakdown | null = null;
  for (const zone of zones) {
    const result = scorePair({ listing, zone, categoryInterest, now });
    if (!best || result.score > best.score) best = result;
  }
  return best;
}

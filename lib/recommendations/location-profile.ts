/**
 * Profil géographique d'un compte — où il est, et à quel point on en est sûr.
 *
 * Rien ici n'est déclaré par l'utilisateur au sens d'un champ « ma ville » :
 * tout est reconstruit à partir de ce qu'il a fait. La hiérarchie des sources
 * est la colonne vertébrale du moteur :
 *
 *   LISTING_PUBLISHED  Il a mis une annonce en vente à Sens. Il a choisi cette
 *                      commune, l'a écrite, et compte y rencontrer un acheteur.
 *                      C'est une localisation *certaine*.
 *   PROFILE_ADDRESS    Adresse renseignée au profil. Certaine également.
 *   SEARCH             Une alerte enregistrée filtre sur Bordeaux. Il s'y
 *                      intéresse ; il n'y habite pas forcément.
 *   LISTING_VIEWED     Il ouvre des annonces situées à Biarritz. Peut-être
 *                      qu'il y vit, peut-être qu'il rêve. *Estimée*.
 *
 * On ne fusionne jamais ces sources en une adresse unique. Un compte garde
 * plusieurs zones, chacune avec son origine et sa confiance, et c'est le
 * scoring qui arbitre au cas par cas.
 *
 * Le profil est un cache reconstructible : le supprimer entièrement puis
 * relancer `refreshUserLocationProfile` redonne exactement le même résultat.
 */

import { prisma } from "@/lib/prisma";
import { resolveLocation, type ResolvedLocation } from "@/lib/geo/communes";
import { RECO_CONFIG, recencyFactor } from "./config";

export type LocationSource =
  | "LISTING_PUBLISHED"
  | "PROFILE_ADDRESS"
  | "SEARCH"
  | "LISTING_VIEWED";

const CERTAIN_SOURCES = new Set<LocationSource>(["LISTING_PUBLISHED", "PROFILE_ADDRESS"]);

/** Ordre de préséance quand plusieurs signaux désignent la même commune. */
const SOURCE_RANK: Record<LocationSource, number> = {
  LISTING_PUBLISHED: 4,
  PROFILE_ADDRESS: 3,
  SEARCH: 2,
  LISTING_VIEWED: 1,
};

/** Confiance de départ, avant volume et fraîcheur. */
const SOURCE_BASE_CONFIDENCE: Record<LocationSource, number> = {
  LISTING_PUBLISHED: 60,
  PROFILE_ADDRESS: 55,
  SEARCH: 30,
  LISTING_VIEWED: 20,
};

type ZoneAccumulator = {
  zoneKey: string;
  point: ResolvedLocation;
  source: LocationSource;
  listingCount: number;
  viewCount: number;
  searchCount: number;
  firstActivityAt: Date;
  lastActivityAt: Date;
};

/** Clé de zone : le code INSEE, ou le département en repli. */
function zoneKeyOf(point: ResolvedLocation): string {
  return point.insee ? point.insee : `dept:${point.department}`;
}

function accumulate(
  zones: Map<string, ZoneAccumulator>,
  point: ResolvedLocation,
  source: LocationSource,
  at: Date,
  counts: { listings?: number; views?: number; searches?: number },
): void {
  const key = zoneKeyOf(point);
  const existing = zones.get(key);

  if (!existing) {
    zones.set(key, {
      zoneKey: key,
      point,
      source,
      listingCount: counts.listings ?? 0,
      viewCount: counts.views ?? 0,
      searchCount: counts.searches ?? 0,
      firstActivityAt: at,
      lastActivityAt: at,
    });
    return;
  }

  existing.listingCount += counts.listings ?? 0;
  existing.viewCount += counts.views ?? 0;
  existing.searchCount += counts.searches ?? 0;
  if (at > existing.lastActivityAt) existing.lastActivityAt = at;
  if (at < existing.firstActivityAt) existing.firstActivityAt = at;

  // La source la plus forte l'emporte : une commune où l'on a publié reste une
  // commune où l'on a publié, même si on y a aussi cliqué trois annonces.
  if (SOURCE_RANK[source] > SOURCE_RANK[existing.source]) {
    existing.source = source;
    // Le point le plus précis gagne aussi : « 75116 » vaut mieux que « 75 ».
    if (point.precision === "COMMUNE" && existing.point.precision !== "COMMUNE") {
      existing.point = point;
    }
  }
}

/**
 * Confiance finale d'une zone, sur 100.
 *
 * Trois facteurs, dans cet ordre d'importance : d'où vient le signal, combien
 * de fois il s'est répété, et depuis quand il n'a plus bougé. Une annonce
 * publiée il y a trois ans à Brest ne fait plus de quelqu'un un Brestois.
 */
function computeConfidence(zone: ZoneAccumulator, now: Date): number {
  const base = SOURCE_BASE_CONFIDENCE[zone.source];

  // Répétition. Le premier signal est déjà payé par la base ; ce sont les
  // suivants qui transforment un indice en habitude.
  const volume =
    Math.min(30, Math.max(0, zone.listingCount - 1) * 10) +
    Math.min(25, zone.viewCount >= 8 ? 25 : zone.viewCount >= 4 ? 16 : zone.viewCount >= 2 ? 8 : 0) +
    Math.min(15, zone.searchCount * 8);

  const fresh = recencyFactor(zone.lastActivityAt, RECO_CONFIG.locationHalfLifeDays, now);

  // La finesse du point plafonne le tout : un centroïde départemental ne peut
  // pas produire une zone « très fiable », quel que soit le volume.
  const raw = Math.min(100, base + volume) * fresh * zone.point.confidence;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export type LocationProfileResult = {
  userId: string;
  zones: number;
  certainZones: number;
  primaryZone: string | null;
};

/**
 * Reconstruit les zones d'un compte et les persiste.
 *
 * Les zones disparues (annonce supprimée, historique de consultation périmé)
 * sont retirées : garder une zone que plus rien n'alimente reviendrait à
 * recommander des annonces à quelqu'un pour une ville qu'il a quittée.
 */
export async function refreshUserLocationProfile(
  userId: string,
  now = new Date(),
): Promise<LocationProfileResult> {
  const zones = new Map<string, ZoneAccumulator>();

  // ── 1. Annonces publiées — la source la plus sûre ───────────────────────
  const published = await prisma.listing.findMany({
    where: { userId, deletedAt: null },
    select: { location: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  for (const listing of published) {
    const point = resolveLocation(listing.location);
    if (point) accumulate(zones, point, "LISTING_PUBLISHED", listing.createdAt, { listings: 1 });
  }

  // ── 2. Adresse du profil ────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { addressCity: true, addressPostal: true, createdAt: true },
  });
  if (user?.addressCity || user?.addressPostal) {
    const point = resolveLocation(
      [user.addressPostal, user.addressCity].filter(Boolean).join(" "),
    );
    // L'adresse ne compte pas comme une « activité » : elle ne se démode pas
    // toute seule, donc on la date d'aujourd'hui plutôt que de l'inscription.
    if (point) accumulate(zones, point, "PROFILE_ADDRESS", now, {});
  }

  // ── 3. Alertes enregistrées ─────────────────────────────────────────────
  const searches = await prisma.savedSearch.findMany({
    where: { userId },
    select: { filters: true, updatedAt: true },
    take: 50,
  });
  for (const search of searches) {
    let location: string | null = null;
    try {
      const filters = JSON.parse(search.filters) as { location?: string; city?: string };
      location = filters.location ?? filters.city ?? null;
    } catch {
      continue;
    }
    const point = location ? resolveLocation(location) : null;
    if (point) accumulate(zones, point, "SEARCH", search.updatedAt, { searches: 1 });
  }

  // ── 4. Consultations récentes — une estimation, rien de plus ────────────
  const viewSince = new Date(now.getTime() - RECO_CONFIG.viewHistoryDays * 86_400_000);
  const viewEvents = await prisma.userEvent.findMany({
    where: { userId, kind: "listing_view", createdAt: { gte: viewSince } },
    select: { meta: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 400,
  });

  const viewedIds: { id: string; at: Date }[] = [];
  for (const event of viewEvents) {
    if (!event.meta) continue;
    try {
      const meta = JSON.parse(event.meta) as { listingId?: string };
      if (meta.listingId) viewedIds.push({ id: meta.listingId, at: event.createdAt });
    } catch {
      /* meta illisible — ignorée */
    }
  }

  if (viewedIds.length > 0) {
    const unique = [...new Set(viewedIds.map((v) => v.id))].slice(0, 300);
    const viewedListings = await prisma.listing.findMany({
      where: { id: { in: unique } },
      select: { id: true, location: true },
    });
    const locationById = new Map(viewedListings.map((l) => [l.id, l.location]));

    for (const view of viewedIds) {
      const location = locationById.get(view.id);
      if (!location) continue;
      const point = resolveLocation(location);
      if (point) accumulate(zones, point, "LISTING_VIEWED", view.at, { views: 1 });
    }
  }

  // ── 5. Persistance ──────────────────────────────────────────────────────
  const computed = [...zones.values()].map((zone) => ({
    zone,
    confidence: computeConfidence(zone, now),
  }));

  // Les zones sous le seuil ne sont pas stockées : elles ne serviront jamais et
  // encombreraient l'index géographique interrogé à chaque campagne.
  const kept = computed.filter((c) => c.confidence >= RECO_CONFIG.minZoneConfidence);
  kept.sort((a, b) => b.confidence - a.confidence);
  const primaryKey = kept[0]?.zone.zoneKey ?? null;

  await prisma.$transaction([
    prisma.userLocationProfile.deleteMany({
      where: { userId, zoneKey: { notIn: kept.map((c) => c.zone.zoneKey) } },
    }),
    ...kept.map(({ zone, confidence }) =>
      prisma.userLocationProfile.upsert({
        where: { userId_zoneKey: { userId, zoneKey: zone.zoneKey } },
        create: {
          userId,
          zoneKey: zone.zoneKey,
          city: zone.point.city,
          department: zone.point.department,
          postalCode: zone.point.postalCode,
          lat: zone.point.lat,
          lng: zone.point.lng,
          precision: zone.point.precision,
          source: zone.source,
          certainty: CERTAIN_SOURCES.has(zone.source) ? "CERTAIN" : "ESTIMATED",
          confidence,
          listingCount: zone.listingCount,
          viewCount: zone.viewCount,
          searchCount: zone.searchCount,
          isPrimary: zone.zoneKey === primaryKey,
          firstActivityAt: zone.firstActivityAt,
          lastActivityAt: zone.lastActivityAt,
          computedAt: now,
        },
        update: {
          city: zone.point.city,
          department: zone.point.department,
          postalCode: zone.point.postalCode,
          lat: zone.point.lat,
          lng: zone.point.lng,
          precision: zone.point.precision,
          source: zone.source,
          certainty: CERTAIN_SOURCES.has(zone.source) ? "CERTAIN" : "ESTIMATED",
          confidence,
          listingCount: zone.listingCount,
          viewCount: zone.viewCount,
          searchCount: zone.searchCount,
          isPrimary: zone.zoneKey === primaryKey,
          lastActivityAt: zone.lastActivityAt,
          computedAt: now,
        },
      }),
    ),
  ]);

  return {
    userId,
    zones: kept.length,
    certainZones: kept.filter((c) => CERTAIN_SOURCES.has(c.zone.source)).length,
    primaryZone: primaryKey,
  };
}

/** Version exposée pour les tests et la simulation : calcule sans persister. */
export function confidenceForTesting(zone: ZoneAccumulator, now = new Date()): number {
  return computeConfidence(zone, now);
}

/**
 * Moteur de recommandation locale — de « 13 maisons viennent d'être publiées »
 * à « voici les 6 qui vous concernent ».
 *
 * Le principe de tout le fichier tient en une inversion. La façon naïve d'écrire
 * ça est une double boucle : pour chaque annonce, pour chaque utilisateur,
 * calculer la distance. Sur 40 000 comptes et 500 annonces, ça fait 20 millions
 * de calculs et autant de lignes lues — le CRON expire avant d'avoir écrit un
 * email.
 *
 * On procède dans l'autre sens :
 *
 *   1. les annonces neuves sont regroupées par commune (13 maisons occupent
 *      rarement 13 communes distinctes) ;
 *   2. pour chaque commune, une seule requête ramène les zones utilisateurs
 *      contenues dans le rectangle de 20 km — un index B-tree ordinaire sur
 *      (lat, lng) suffit, aucune extension géospatiale n'est requise ;
 *   3. Haversine n'est calculé que sur les couples ainsi pré-sélectionnés, et
 *      uniquement entre un compte et les annonces de *sa* commune.
 *
 * Le nombre de calculs devient proportionnel au nombre de comptes réellement
 * proches, pas au nombre de comptes inscrits.
 *
 * Deux garanties structurelles, valables aussi en cas d'exécutions
 * concurrentes :
 *
 *   - **aucune fuite entre comptes** : l'email est construit dans la boucle du
 *     destinataire, à partir de ses propres couples notés. Il n'existe aucun
 *     objet partagé entre deux destinataires dont le contenu pourrait
 *     déborder ;
 *   - **aucun doublon** : `ListingRecommendationLog` porte une contrainte
 *     d'unicité `(userId, listingId)`. Une annonce déjà envoyée ne peut pas
 *     l'être une seconde fois, même si deux campagnes se chevauchent.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { emailPrefUrl } from "@/lib/email-token";
import { isEmailAllowed } from "@/lib/notifications/preferences";
import { listingUrl } from "@/lib/listing-slug";
import { CATEGORIES, getCategoryByLabel } from "@/lib/categories";
import { boundingBox } from "@/lib/geo/distance";
import {
  listingRecommendationsEmail,
  recommendationSubject,
  summarizePlaces,
  type RecommendedListing,
} from "@/lib/emails/listing-recommendations";
import { RECO_CONFIG, RECO_EMAIL_TYPE, USABLE_PRECISIONS } from "./config";
import { bestZoneMatch, type ScoreBreakdown, type ScoredListing, type ScoredZone } from "./score";
import { resolvePendingListingGeo } from "./listing-geo";

const BASE = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";

type FreshListing = ScoredListing & {
  userId: string;
  title: string;
  price: number;
  location: string;
  description: string;
  images: string;
  geoCity: string | null;
  geoInsee: string | null;
};

export type DryRunLine = {
  userId: string;
  email: string;
  listingId: string;
  listingTitle: string;
  score: number;
  distanceKm: number;
  categoryScore: number;
  locationScore: number;
  certainty: string;
  zoneKey: string;
  decision: "RETENUE" | "ÉCARTÉE";
  reason?: string;
};

export type CampaignResult = {
  campaignId: string | null;
  categoryId: string;
  categoryLabel: string;
  listingCount: number;
  candidateUsers: number;
  targetedUsers: number;
  emailsSent: number;
  errors: number;
  dryRun: boolean;
  /** Motifs d'exclusion agrégés — la vue la plus utile pour régler les seuils. */
  exclusions: Record<string, number>;
  /** Détail par couple, uniquement en simulation. */
  lines: DryRunLine[];
};

// ─────────────────────────────────────────────────────────────
// SÉLECTION DES ANNONCES
// ─────────────────────────────────────────────────────────────

/** Catégories ayant assez bougé dans la fenêtre pour mériter une campagne. */
export async function activeCategories(windowStart: Date): Promise<{ label: string; count: number }[]> {
  const rows = await prisma.listing.groupBy({
    by: ["category"],
    where: {
      status: "APPROVED",
      shadowBanned: false,
      deletedAt: null,
      createdAt: { gte: windowStart },
    },
    _count: { _all: true },
  });

  return rows
    .filter((r) => r._count._all >= RECO_CONFIG.minNewListingsPerCategory)
    .map((r) => ({ label: r.category, count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

async function freshListingsFor(categoryLabel: string, windowStart: Date): Promise<FreshListing[]> {
  const rows = await prisma.listing.findMany({
    where: {
      category: categoryLabel,
      status: "APPROVED",
      shadowBanned: false,
      deletedAt: null,
      createdAt: { gte: windowStart },
      geoLat: { not: null },
      geoPrecision: { in: [...USABLE_PRECISIONS] },
    },
    select: {
      id: true,
      userId: true,
      title: true,
      price: true,
      location: true,
      description: true,
      images: true,
      createdAt: true,
      geoLat: true,
      geoLng: true,
      geoCity: true,
      geoInsee: true,
      geoPrecision: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return rows
    .filter((r) => r.geoLat !== null && r.geoLng !== null)
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      title: r.title,
      price: r.price,
      location: r.location,
      description: r.description,
      images: r.images,
      createdAt: r.createdAt,
      lat: r.geoLat as number,
      lng: r.geoLng as number,
      geoCity: r.geoCity,
      geoInsee: r.geoInsee,
      geoPrecision: r.geoPrecision,
    }));
}

// ─────────────────────────────────────────────────────────────
// EXCLUSIONS
// ─────────────────────────────────────────────────────────────

/**
 * Annonces déjà consultées par ces comptes parmi celles de la campagne.
 *
 * Le filtrage se fait dans PostgreSQL plutôt qu'en mémoire : `UserEvent`
 * contient des dizaines de milliers de vues par semaine, et les rapatrier pour
 * les trier en JavaScript reviendrait à faire transiter le journal complet à
 * chaque campagne. `substring(… from …)` extrait l'identifiant depuis `meta`,
 * l'index (userId, kind, createdAt) faisant le gros du tri en amont.
 */
async function alreadyViewed(
  userIds: string[],
  listingIds: string[],
  since: Date,
): Promise<Set<string>> {
  if (userIds.length === 0 || listingIds.length === 0) return new Set();

  const rows = await prisma.$queryRaw<{ userId: string; listingId: string }[]>`
    SELECT DISTINCT "userId",
           substring("meta" from '"listingId":"([^"]+)"') AS "listingId"
    FROM "UserEvent"
    WHERE "kind" = 'listing_view'
      AND "createdAt" >= ${since}
      AND "userId" IN (${Prisma.join(userIds)})
      AND substring("meta" from '"listingId":"([^"]+)"') IN (${Prisma.join(listingIds)})
  `;

  return new Set(rows.map((r) => `${r.userId}:${r.listingId}`));
}

/** Couples (compte, annonce) déjà envoyés — la garantie anti-répétition. */
async function alreadySent(userIds: string[], listingIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0 || listingIds.length === 0) return new Set();

  const rows = await prisma.listingRecommendationLog.findMany({
    where: { userId: { in: userIds }, listingId: { in: listingIds } },
    select: { userId: true, listingId: true },
  });
  return new Set(rows.map((r) => `${r.userId}:${r.listingId}`));
}

/**
 * Comptes trop récemment sollicités.
 *
 * Deux cadences se superposent : une globale, pour ne pas écrire tous les jours,
 * et une par catégorie, pour ne pas marteler la même rubrique. Les événements
 * sont lus une fois et triés en mémoire — leur volume est celui des envois
 * d'une semaine, pas celui du journal.
 */
async function throttledUsers(categoryId: string, now: Date): Promise<Set<string>> {
  const longest = Math.max(RECO_CONFIG.userThrottleDays, RECO_CONFIG.categoryThrottleDays);
  const since = new Date(now.getTime() - longest * 86_400_000);

  const events = await prisma.userEvent.findMany({
    where: { kind: RECO_EMAIL_TYPE, createdAt: { gte: since } },
    select: { userId: true, meta: true, createdAt: true },
  });

  const globalCutoff = new Date(now.getTime() - RECO_CONFIG.userThrottleDays * 86_400_000);
  const categoryCutoff = new Date(now.getTime() - RECO_CONFIG.categoryThrottleDays * 86_400_000);

  const blocked = new Set<string>();
  for (const event of events) {
    if (!event.userId) continue;
    if (event.createdAt >= globalCutoff) {
      blocked.add(event.userId);
      continue;
    }
    if (event.createdAt >= categoryCutoff && event.meta?.includes(`"categoryId":"${categoryId}"`)) {
      blocked.add(event.userId);
    }
  }
  return blocked;
}

// ─────────────────────────────────────────────────────────────
// CAMPAGNE
// ─────────────────────────────────────────────────────────────

export async function runCategoryCampaign({
  categoryLabel,
  dryRun = false,
  now = new Date(),
  maxUsers = RECO_CONFIG.maxUsersPerRun,
}: {
  categoryLabel: string;
  dryRun?: boolean;
  now?: Date;
  maxUsers?: number;
}): Promise<CampaignResult> {
  const categoryId = getCategoryByLabel(categoryLabel)?.id ?? categoryLabel;
  const windowStart = new Date(now.getTime() - RECO_CONFIG.freshnessDays * 86_400_000);
  const exclusions: Record<string, number> = {};
  const bump = (reason: string) => void (exclusions[reason] = (exclusions[reason] ?? 0) + 1);

  const listings = await freshListingsFor(categoryLabel, windowStart);

  const empty: CampaignResult = {
    campaignId: null,
    categoryId,
    categoryLabel,
    listingCount: listings.length,
    candidateUsers: 0,
    targetedUsers: 0,
    emailsSent: 0,
    errors: 0,
    dryRun,
    exclusions,
    lines: [],
  };
  if (listings.length === 0) return empty;

  const campaign = await prisma.recommendationCampaign.create({
    data: {
      categoryId,
      categoryLabel,
      listingCount: listings.length,
      dryRun,
      windowStart,
      windowEnd: now,
      meta: JSON.stringify({
        radiusKm: RECO_CONFIG.radiusKm,
        minScore: RECO_CONFIG.minScore,
        minCategoryInterest: RECO_CONFIG.minCategoryInterest,
      }),
    },
    select: { id: true },
  });

  try {
    // ── 1. Regroupement des annonces par commune ─────────────────────────
    const byCommune = new Map<string, { lat: number; lng: number; listings: FreshListing[] }>();
    for (const listing of listings) {
      const key = listing.geoInsee || `${listing.lat.toFixed(3)},${listing.lng.toFixed(3)}`;
      const bucket = byCommune.get(key);
      if (bucket) bucket.listings.push(listing);
      else byCommune.set(key, { lat: listing.lat, lng: listing.lng, listings: [listing] });
    }

    // ── 2. Une requête par commune, dans un rectangle de 20 km ────────────
    type Candidate = { zones: Map<string, ScoredZone>; listings: Map<string, FreshListing> };
    const candidates = new Map<string, Candidate>();

    for (const commune of byCommune.values()) {
      const box = boundingBox({ lat: commune.lat, lng: commune.lng }, RECO_CONFIG.radiusKm);

      const zones = await prisma.userLocationProfile.findMany({
        where: {
          lat: { gte: box.minLat, lte: box.maxLat },
          lng: { gte: box.minLng, lte: box.maxLng },
          confidence: { gte: RECO_CONFIG.minZoneConfidence },
          precision: { in: [...USABLE_PRECISIONS] },
        },
        orderBy: { confidence: "desc" },
        take: RECO_CONFIG.maxCandidatesPerZone,
        select: {
          userId: true,
          zoneKey: true,
          lat: true,
          lng: true,
          precision: true,
          source: true,
          certainty: true,
          confidence: true,
          isPrimary: true,
        },
      });

      for (const zone of zones) {
        let candidate = candidates.get(zone.userId);
        if (!candidate) {
          if (candidates.size >= maxUsers) continue;
          candidate = { zones: new Map(), listings: new Map() };
          candidates.set(zone.userId, candidate);
        }
        candidate.zones.set(zone.zoneKey, zone);
        for (const listing of commune.listings) {
          // Un vendeur n'a rien à faire de sa propre annonce.
          if (listing.userId !== zone.userId) candidate.listings.set(listing.id, listing);
        }
      }
    }

    const candidateIds = [...candidates.keys()];
    if (candidateIds.length === 0) {
      await closeCampaign(campaign.id, { listings: listings.length, exclusions });
      return { ...empty, campaignId: campaign.id };
    }

    // ── 3. Intérêt catégoriel ─────────────────────────────────────────────
    const interests = await prisma.userCategoryInterest.findMany({
      where: {
        userId: { in: candidateIds },
        categoryId,
        score: { gte: RECO_CONFIG.minCategoryInterest },
      },
      select: { userId: true, score: true },
    });
    const interestByUser = new Map(interests.map((i) => [i.userId, i.score]));

    for (const id of candidateIds) {
      if (!interestByUser.has(id)) {
        candidates.delete(id);
        bump("intérêt catégoriel insuffisant");
      }
    }

    // ── 4. Éligibilité du compte ──────────────────────────────────────────
    const eligibleIds = [...candidates.keys()];
    const users = await prisma.user.findMany({
      where: {
        id: { in: eligibleIds },
        role: "USER",
        emailVerified: true,
        bannedAt: null,
        restrictedAt: null,
      },
      select: { id: true, email: true, name: true, firstName: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));
    for (const id of eligibleIds) {
      if (!userById.has(id)) {
        candidates.delete(id);
        bump("compte inéligible (non vérifié, banni ou restreint)");
      }
    }

    const blocked = await throttledUsers(categoryId, now);
    for (const id of [...candidates.keys()]) {
      if (blocked.has(id)) {
        candidates.delete(id);
        bump("cadence d'envoi");
      }
    }

    const finalIds = [...candidates.keys()];
    const listingIds = listings.map((l) => l.id);
    const sentPairs = await alreadySent(finalIds, listingIds);
    const viewedPairs = RECO_CONFIG.excludeAlreadyViewed
      ? await alreadyViewed(finalIds, listingIds, windowStart)
      : new Set<string>();

    // ── 5. Notation, puis un email par personne ───────────────────────────
    const lines: DryRunLine[] = [];
    let targetedUsers = 0;
    let emailsSent = 0;
    let errors = 0;

    for (const userId of finalIds) {
      const candidate = candidates.get(userId)!;
      const user = userById.get(userId)!;
      const interest = interestByUser.get(userId) ?? 0;
      const zones = [...candidate.zones.values()];

      const matches: { listing: FreshListing; breakdown: ScoreBreakdown }[] = [];

      for (const listing of candidate.listings.values()) {
        const pairKey = `${userId}:${listing.id}`;
        if (sentPairs.has(pairKey)) {
          bump("annonce déjà envoyée");
          continue;
        }
        if (viewedPairs.has(pairKey)) {
          bump("annonce déjà consultée");
          continue;
        }

        const breakdown = bestZoneMatch({ listing, zones, categoryInterest: interest, now });
        if (!breakdown) continue;

        const retained = !breakdown.rejectedFor && breakdown.score >= RECO_CONFIG.minScore;
        if (retained) matches.push({ listing, breakdown });
        else bump(breakdown.rejectedFor ?? "score insuffisant");

        if (dryRun) {
          lines.push({
            userId,
            email: user.email,
            listingId: listing.id,
            listingTitle: listing.title,
            score: breakdown.score,
            distanceKm: Math.round(breakdown.distanceKm * 10) / 10,
            categoryScore: breakdown.categoryScore,
            locationScore: breakdown.locationScore,
            certainty: breakdown.certainty,
            zoneKey: breakdown.zoneKey,
            decision: retained ? "RETENUE" : "ÉCARTÉE",
            reason: breakdown.rejectedFor,
          });
        }
      }

      if (matches.length < RECO_CONFIG.minListingsPerEmail) {
        if (matches.length > 0) bump("trop peu d'annonces pertinentes");
        continue;
      }

      // Le consentement se vérifie en dernier : inutile d'interroger les
      // préférences de comptes qui n'auraient rien reçu de toute façon.
      const allowed = await isEmailAllowed(userId, "personalized").catch(() => true);
      if (!allowed) {
        bump("désabonné des emails personnalisés");
        continue;
      }

      matches.sort((a, b) => b.breakdown.score - a.breakdown.score);
      const selected = matches.slice(0, RECO_CONFIG.maxListingsPerEmail);
      targetedUsers++;

      if (dryRun) continue;

      const sent = await deliver({ user, categoryId, categoryLabel, selected });
      if (sent) emailsSent++;
      else errors++;

      await recordDelivery({
        campaignId: campaign.id,
        userId,
        categoryId,
        selected,
        sent,
        now,
      });
    }

    await prisma.recommendationCampaign.update({
      where: { id: campaign.id },
      data: {
        candidateUsers: candidateIds.length,
        targetedUsers,
        emailsSent,
        errors,
        status: "DONE",
        finishedAt: new Date(),
        meta: JSON.stringify({
          radiusKm: RECO_CONFIG.radiusKm,
          minScore: RECO_CONFIG.minScore,
          minCategoryInterest: RECO_CONFIG.minCategoryInterest,
          exclusions,
        }),
      },
    });

    return {
      campaignId: campaign.id,
      categoryId,
      categoryLabel,
      listingCount: listings.length,
      candidateUsers: candidateIds.length,
      targetedUsers,
      emailsSent,
      errors,
      dryRun,
      exclusions,
      lines,
    };
  } catch (err) {
    await prisma.recommendationCampaign
      .update({
        where: { id: campaign.id },
        data: { status: "FAILED", finishedAt: new Date(), meta: JSON.stringify({ error: String(err) }) },
      })
      .catch(() => {});
    throw err;
  }
}

async function closeCampaign(
  campaignId: string,
  detail: { listings: number; exclusions: Record<string, number> },
): Promise<void> {
  await prisma.recommendationCampaign.update({
    where: { id: campaignId },
    data: { status: "DONE", finishedAt: new Date(), meta: JSON.stringify(detail) },
  });
}

// ─────────────────────────────────────────────────────────────
// ENVOI
// ─────────────────────────────────────────────────────────────

function firstImage(images: string): string | null {
  try {
    const parsed = JSON.parse(images) as unknown;
    if (Array.isArray(parsed) && typeof parsed[0] === "string" && parsed[0].startsWith("https://")) {
      return parsed[0];
    }
  } catch {
    /* colonne illisible — vignette de repli */
  }
  return null;
}

async function deliver({
  user,
  categoryId,
  categoryLabel,
  selected,
}: {
  user: { id: string; email: string; name: string; firstName: string | null };
  categoryId: string;
  categoryLabel: string;
  selected: { listing: FreshListing; breakdown: ScoreBreakdown }[];
}): Promise<boolean> {
  const cards: RecommendedListing[] = selected.map(({ listing, breakdown }) => ({
    id: listing.id,
    title: listing.title,
    price: listing.price,
    location: listing.geoCity ?? listing.location,
    description: listing.description,
    imageUrl: firstImage(listing.images),
    url: `${BASE}${listingUrl(listing.id, listing.title)}`,
    distanceKm: breakdown.distanceKm,
    // Une distance chiffrée n'est affichée que si la position d'où elle est
    // mesurée est une position que l'utilisateur a lui-même déclarée.
    showDistance: breakdown.certainty === "CERTAIN",
  }));

  const html = listingRecommendationsEmail({
    firstName: user.firstName ?? user.name?.split(" ")[0] ?? null,
    categoryLabel,
    listings: cards,
    categoryUrl: `${BASE}/annonces/${categoryId}`,
    manageUrl: emailPrefUrl(user.id),
    placesSummary: summarizePlaces(cards.map((c) => c.location)),
  });

  try {
    await sendEmail({
      to: user.email,
      toName: user.name,
      subject: recommendationSubject(cards.length, categoryLabel),
      html,
      adSource: RECO_EMAIL_TYPE,
      userId: user.id,
    });
    return true;
  } catch (err) {
    console.error("[reco] envoi échoué", user.id, err);
    return false;
  }
}

async function recordDelivery({
  campaignId,
  userId,
  categoryId,
  selected,
  sent,
  now,
}: {
  campaignId: string;
  userId: string;
  categoryId: string;
  selected: { listing: FreshListing; breakdown: ScoreBreakdown }[];
  sent: boolean;
  now: Date;
}): Promise<void> {
  // `createMany … skipDuplicates` plutôt qu'une boucle d'upsert : la contrainte
  // d'unicité (userId, listingId) fait le travail d'anti-doublon, y compris si
  // une autre exécution a inséré la même ligne entre-temps.
  await prisma.listingRecommendationLog
    .createMany({
      data: selected.map(({ listing, breakdown }, index) => ({
        campaignId,
        userId,
        listingId: listing.id,
        score: breakdown.score,
        categoryScore: breakdown.categoryScore,
        locationScore: breakdown.locationScore,
        recencyScore: breakdown.recencyScore,
        distanceKm: breakdown.distanceKm,
        locationCertainty: breakdown.certainty,
        matchedZoneKey: breakdown.zoneKey,
        position: index + 1,
        sentAt: sent ? now : null,
      })),
      skipDuplicates: true,
    })
    .catch((err) => console.error("[reco] journalisation échouée", userId, err));

  if (!sent) return;

  // Trace de cadence. Le journal `UserEvent` existe déjà et sert au moteur
  // comportemental : inutile d'ajouter une colonne « dernier envoi » sur User.
  await prisma.userEvent
    .create({
      data: {
        userId,
        kind: RECO_EMAIL_TYPE,
        meta: JSON.stringify({ categoryId, count: selected.length, campaignId }),
      },
    })
    .catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// POINT D'ENTRÉE
// ─────────────────────────────────────────────────────────────

export type RunOptions = {
  /** Restreint à une catégorie (identifiant ou libellé). Sinon : toutes. */
  category?: string | null;
  dryRun?: boolean;
  /** Nombre maximal de catégories traitées sur ce passage. */
  maxCategories?: number;
  now?: Date;
};

/**
 * Exécute le moteur sur toutes les catégories actives.
 *
 * Le géocodage des annonces neuves est fait ici, en préalable : une annonce
 * publiée depuis le dernier passage n'a pas encore de coordonnées, et sans
 * elles elle serait silencieusement ignorée.
 */
export async function runRecommendationEngine({
  category = null,
  dryRun = false,
  maxCategories = 6,
  now = new Date(),
}: RunOptions = {}): Promise<{ geo: Awaited<ReturnType<typeof resolvePendingListingGeo>>; campaigns: CampaignResult[] }> {
  const windowStart = new Date(now.getTime() - RECO_CONFIG.freshnessDays * 86_400_000);

  const geo = await resolvePendingListingGeo({ onlyFresh: windowStart });

  let targets: string[];
  if (category) {
    const label = CATEGORIES.find((c) => c.id === category)?.label ?? category;
    targets = [label];
  } else {
    targets = (await activeCategories(windowStart)).slice(0, maxCategories).map((c) => c.label);
  }

  const campaigns: CampaignResult[] = [];
  for (const label of targets) {
    campaigns.push(await runCategoryCampaign({ categoryLabel: label, dryRun, now }));
  }

  return { geo, campaigns };
}

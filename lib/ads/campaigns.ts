/**
 * Création et cycle de vie d'une campagne.
 *
 * Toute la validation vit ici, jamais dans l'assistant : celui-ci guide, il ne
 * décide pas. Un budget négatif, une date passée ou un emplacement inventé
 * sont refusés au même endroit, que la demande vienne du site, de
 * l'application ou d'un script.
 */
import { prisma } from "@/lib/prisma";
import { resolveLocation } from "@/lib/geo/communes";
import { normalizeToken } from "@/lib/seo/city";
import { invalidateAdCache } from "./engine";
import { AGE_RANGES, isObjective, isPlacement } from "./placements";

/** Plancher : en dessous, une campagne ne peut rien acheter. */
const MIN_DAILY_CENTS = 200;
/** Plafond de sécurité, le temps que la facturation soit branchée. */
const MAX_TOTAL_CENTS = 500_000;
const MAX_ZONES = 10;
const MAX_DURATION_DAYS = 180;

export class CampaignError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CampaignError";
  }
}

export type ZoneInput = { label: string; radiusKm?: number };

export type CampaignInput = {
  name: string;
  objective: string;
  startAt: string;
  endAt: string;
  dailyBudgetCents: number;
  totalBudgetCents: number;
  placements: string[];
  zones: ZoneInput[];
  audienceAges?: string[];
  categories?: string[];
  /** L'annonceur accepte d'être diffusé selon l'intention du visiteur. */
  smartTargeting?: boolean;
  creative: {
    title: string;
    description: string;
    imageUrl: string;
    imageUrlWide?: string | null;
    ctaLabel: string;
    destinationUrl?: string | null;
    listingId?: string | null;
  };
};

/**
 * Transforme une saisie d'assistant en campagne enregistrée, à l'état de
 * brouillon. La soumission à la modération est un geste séparé : on ne veut
 * pas qu'un aller-retour dans le formulaire déclenche une validation.
 */
export async function createCampaign(advertiserId: string, input: CampaignInput) {
  const name = input.name.trim();
  if (name.length < 3) throw new CampaignError("Donnez un nom à votre campagne.", 400);
  if (!isObjective(input.objective)) throw new CampaignError("Objectif inconnu.", 400);

  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new CampaignError("Dates invalides.", 400);
  }
  if (endAt <= startAt) throw new CampaignError("La date de fin doit suivre la date de début.", 400);
  const days = Math.ceil((endAt.getTime() - startAt.getTime()) / 86_400_000);
  if (days > MAX_DURATION_DAYS) {
    throw new CampaignError(`Durée limitée à ${MAX_DURATION_DAYS} jours.`, 400);
  }

  const daily = Math.round(input.dailyBudgetCents);
  const total = Math.round(input.totalBudgetCents);
  if (daily < MIN_DAILY_CENTS) {
    throw new CampaignError(`Budget quotidien minimum : ${(MIN_DAILY_CENTS / 100).toFixed(2)} €.`, 400);
  }
  if (total < daily) {
    throw new CampaignError("Le budget total ne peut pas être inférieur au budget quotidien.", 400);
  }
  if (total > MAX_TOTAL_CENTS) {
    throw new CampaignError(`Budget total limité à ${MAX_TOTAL_CENTS / 100} € pour l'instant.`, 400);
  }

  const placements = [...new Set(input.placements)].filter(isPlacement);
  if (placements.length === 0) {
    throw new CampaignError("Choisissez au moins un emplacement.", 400);
  }

  // Zones résolues à l'enregistrement : le moteur ne doit avoir aucune
  // géocodification à faire au moment de servir une publicité.
  const zones = [];
  for (const zone of (input.zones ?? []).slice(0, MAX_ZONES)) {
    const resolved = resolveLocation(zone.label);
    if (!resolved) {
      throw new CampaignError(`Ville inconnue : ${zone.label}.`, 400);
    }
    zones.push({
      label: resolved.city,
      citySlug: normalizeToken(resolved.city),
      postalCode: resolved.postalCode,
      lat: resolved.lat,
      lng: resolved.lng,
      radiusKm: Math.max(0, Math.min(200, Math.round(zone.radiusKm ?? 0))),
    });
  }

  const ages = (input.audienceAges ?? []).filter((a) =>
    (AGE_RANGES as readonly string[]).includes(a),
  );

  const creative = input.creative;
  if (!creative?.title?.trim()) throw new CampaignError("Titre de la publicité requis.", 400);
  if (!creative.imageUrl?.trim()) throw new CampaignError("Ajoutez un visuel.", 400);
  if (!creative.destinationUrl && !creative.listingId) {
    throw new CampaignError("Indiquez où mène votre publicité.", 400);
  }
  if (creative.destinationUrl && !/^https?:\/\//i.test(creative.destinationUrl)) {
    throw new CampaignError("L'adresse de destination doit commencer par https://.", 400);
  }

  return prisma.adCampaign.create({
    data: {
      advertiserId,
      name: name.slice(0, 120),
      objective: input.objective,
      status: "DRAFT",
      startAt,
      endAt,
      dailyBudgetCents: daily,
      totalBudgetCents: total,
      audienceAges: JSON.stringify(ages),
      categories: JSON.stringify((input.categories ?? []).slice(0, 10)),
      smartTargeting: input.smartTargeting === true,
      zones: { create: zones },
      placements: { create: placements.map((placement) => ({ placement })) },
      ads: {
        create: {
          title: creative.title.trim().slice(0, 80),
          description: creative.description.trim().slice(0, 200),
          imageUrl: creative.imageUrl.trim(),
          imageUrlWide: creative.imageUrlWide?.trim() || null,
          ctaLabel: creative.ctaLabel.trim().slice(0, 30) || "En savoir plus",
          destinationUrl: creative.destinationUrl?.trim() || null,
          listingId: creative.listingId || null,
        },
      },
    },
    include: { zones: true, placements: true, ads: true },
  });
}

/** Passage en modération. Seul un brouillon ou une campagne refusée peut partir. */
export async function submitCampaign(advertiserId: string, campaignId: string) {
  const campaign = await prisma.adCampaign.findFirst({
    where: { id: campaignId, advertiserId },
    select: { id: true, status: true, ads: { select: { id: true } } },
  });
  if (!campaign) throw new CampaignError("Campagne introuvable.", 404);
  if (!["DRAFT", "REJECTED"].includes(campaign.status)) {
    throw new CampaignError("Cette campagne est déjà soumise.", 409);
  }
  if (campaign.ads.length === 0) {
    throw new CampaignError("Ajoutez une publicité avant de soumettre.", 400);
  }

  return prisma.adCampaign.update({
    where: { id: campaign.id },
    data: { status: "PENDING_REVIEW", submittedAt: new Date(), reviewNote: null },
  });
}

/**
 * Décision de modération.
 *
 * Une campagne validée dont la date de début est passée démarre tout de suite ;
 * sinon elle attend, programmée. C'est le cron qui la fera basculer — l'admin
 * n'a pas à revenir cliquer le jour J.
 */
export async function decideCampaign(input: {
  campaignId: string;
  approve: boolean;
  note?: string | null;
  adminId: string;
}) {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: input.campaignId },
    select: { id: true, status: true, startAt: true },
  });
  if (!campaign) throw new CampaignError("Campagne introuvable.", 404);

  const note = input.note?.trim() || null;
  if (!input.approve && !note) {
    throw new CampaignError("Un motif de refus est obligatoire : il est envoyé à l'annonceur.", 400);
  }

  const status = input.approve
    ? campaign.startAt <= new Date()
      ? "ACTIVE"
      : "SCHEDULED"
    : "REJECTED";

  const updated = await prisma.adCampaign.update({
    where: { id: campaign.id },
    data: {
      status,
      reviewNote: note,
      reviewedAt: new Date(),
      reviewedBy: input.adminId,
    },
  });

  // Le moteur garde les campagnes servables en mémoire trente secondes : sans
  // cette purge, une campagne validée mettrait une demi-minute à apparaître, et
  // une campagne refusée continuerait de s'afficher.
  invalidateAdCache();
  return updated;
}

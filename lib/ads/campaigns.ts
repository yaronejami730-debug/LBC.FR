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
import { floorsOf, modelForObjective, pricing, stopCampaign } from "./billing";
import { releaseCampaignBudget, reserveCampaignBudget, walletState, WalletError } from "./wallet";
import { invalidateExemptCache } from "./tracking";
import type { BillingModel } from "./auction";

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
  /**
   * Enchère maximale, en centimes : par clic pour les objectifs de visite et
   * de contact, pour mille impressions visibles pour la visibilité. C'est un
   * plafond, jamais un prix — l'enchère au second prix fera presque toujours
   * payer moins.
   */
  maxBidCents?: number;
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

  // ── Enchère ──────────────────────────────────────────────────────────────
  // Le modèle vient de l'objectif : la visibilité s'achète à l'impression
  // visible, tout le reste au clic. L'annonceur ne choisit pas son modèle, il
  // choisit ce qu'il veut obtenir — et c'est le rôle du formulaire de le dire
  // clairement plutôt que de faire cocher une case technique.
  const billingModel: BillingModel = modelForObjective(input.objective);

  // Plancher : le plus élevé des emplacements retenus. Prendre le plus bas
  // laisserait créer une campagne qui ne peut structurellement jamais gagner
  // sur la moitié des emplacements qu'elle a cochés.
  const grid = await pricing();
  const floor = Math.max(
    ...placements.map((p) => {
      const f = floorsOf(grid.get(p));
      return billingModel === "CPM" ? f.cpmCents : f.cpcCents;
    }),
  );

  const maxBid = Math.round(input.maxBidCents ?? 0);
  if (maxBid < floor) {
    throw new CampaignError(
      billingModel === "CPM"
        ? `Enchère minimale pour ces emplacements : ${(floor / 100).toFixed(2)} € pour mille impressions visibles.`
        : `Enchère minimale pour ces emplacements : ${(floor / 100).toFixed(2)} € par clic.`,
      400,
    );
  }
  // Un plafond supérieur au budget du jour ne veut rien dire : la campagne
  // s'arrêterait au premier clic. Refuser tôt évite un budget consommé en une
  // seconde et une incompréhension le lendemain.
  if (billingModel === "CPC" && maxBid > daily) {
    throw new CampaignError(
      "Votre enchère maximale dépasse votre budget quotidien : un seul clic épuiserait la journée.",
      400,
    );
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
      maxBidCents: maxBid,
      billingModel,
      bidStrategy: "MANUAL",
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

/**
 * Passage en modération.
 *
 * Seul un brouillon ou une campagne refusée peut partir. Le portefeuille est
 * contrôlé ici, avant la file de validation : découvrir un solde insuffisant
 * après le passage d'un modérateur ferait perdre du temps aux deux, et
 * l'annonceur croirait sa campagne lancée.
 */
export async function submitCampaign(advertiserId: string, campaignId: string) {
  const campaign = await prisma.adCampaign.findFirst({
    where: { id: campaignId, advertiserId },
    select: {
      id: true,
      status: true,
      totalBudgetCents: true,
      spentCents: true,
      billingExemptAt: true,
      ads: { select: { id: true } },
    },
  });
  if (!campaign) throw new CampaignError("Campagne introuvable.", 404);
  if (!["DRAFT", "REJECTED"].includes(campaign.status)) {
    throw new CampaignError("Cette campagne est déjà soumise.", 409);
  }
  if (campaign.ads.length === 0) {
    throw new CampaignError("Ajoutez une publicité avant de soumettre.", 400);
  }

  // Une campagne exonérée par la régie ne consomme rien : exiger un solde
  // reviendrait à refuser une diffusion offerte faute d'argent qu'elle ne
  // dépensera pas.
  if (!campaign.billingExemptAt) {
    const wallet = await walletState(advertiserId);
    if (wallet && !wallet.billingDisabled) {
      const needed = campaign.totalBudgetCents - campaign.spentCents;
      if (wallet.availableCents < needed) {
        throw new CampaignError(
          `Portefeuille insuffisant : ${(wallet.availableCents / 100).toFixed(2)} € disponibles pour un budget de ${(needed / 100).toFixed(2)} €. Rechargez avant de lancer.`,
          409,
        );
      }
    }
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
 *
 * L'acceptation **engage le budget** sur le portefeuille : à partir de là, la
 * somme n'est plus disponible pour une autre campagne. Sans cet engagement,
 * deux campagnes de 400 € pourraient être lancées sur un portefeuille de 500 €,
 * et la seconde s'arrêterait au milieu de la semaine sans que personne ait
 * rien fait de mal.
 *
 * Un portefeuille insuffisant ne refuse pas la campagne : elle est validée mais
 * mise en attente de recharge. Le travail de modération est fait, il n'a pas à
 * être refait après le paiement.
 */
export async function decideCampaign(input: {
  campaignId: string;
  approve: boolean;
  note?: string | null;
  adminId: string;
  /**
   * Diffusion offerte : la campagne tourne sans rien débiter, jusqu'à ce que la
   * régie rétablisse la facturation. Décidé ici parce que c'est le moment où
   * quelqu'un regarde la campagne avant qu'elle parte.
   */
  billingExempt?: boolean;
  exemptReason?: string | null;
}) {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: input.campaignId },
    select: {
      id: true,
      name: true,
      status: true,
      startAt: true,
      advertiserId: true,
      totalBudgetCents: true,
      spentCents: true,
      billingExemptAt: true,
    },
  });
  if (!campaign) throw new CampaignError("Campagne introuvable.", 404);

  const note = input.note?.trim() || null;
  if (!input.approve && !note) {
    throw new CampaignError("Un motif de refus est obligatoire : il est envoyé à l'annonceur.", 400);
  }

  const exempt =
    input.billingExempt === undefined ? Boolean(campaign.billingExemptAt) : input.billingExempt;

  let status = input.approve
    ? campaign.startAt <= new Date()
      ? "ACTIVE"
      : "SCHEDULED"
    : "REJECTED";
  let pausedReason: string | null = null;

  if (input.approve && !exempt) {
    try {
      await reserveCampaignBudget({
        advertiserId: campaign.advertiserId,
        campaignId: campaign.id,
        amountCents: Math.max(0, campaign.totalBudgetCents - campaign.spentCents),
        label: `Budget engagé — ${campaign.name}`,
      });
    } catch (e) {
      if (!(e instanceof WalletError)) throw e;
      status = "PAUSED_INSUFFICIENT_FUNDS";
      pausedReason = "Portefeuille insuffisant — rechargez pour lancer la diffusion";
    }
  }

  const updated = await prisma.adCampaign.update({
    where: { id: campaign.id },
    data: {
      status,
      pausedReason,
      reviewNote: note,
      reviewedAt: new Date(),
      reviewedBy: input.adminId,
      ...(input.billingExempt === undefined
        ? {}
        : {
            billingExemptAt: input.billingExempt ? new Date() : null,
            billingExemptReason: input.billingExempt ? (input.exemptReason?.trim() || null) : null,
            billingExemptBy: input.billingExempt ? input.adminId : null,
          }),
    },
  });

  // Le moteur garde les campagnes servables en mémoire trente secondes : sans
  // cette purge, une campagne validée mettrait une demi-minute à apparaître, et
  // une campagne refusée continuerait de s'afficher.
  invalidateAdCache();
  invalidateExemptCache(campaign.id);
  return updated;
}

/**
 * Exonération de facturation d'une campagne — décision de la régie.
 *
 * Activable et désactivable à tout moment, y compris en pleine diffusion, et
 * **jamais rétroactive** : ce qui a été facturé reste facturé, ce qui vient
 * après suit la nouvelle règle. Une exonération rétroactive obligerait à
 * rembourser des événements déjà agrégés, et plus personne ne saurait dire ce
 * qui a été réellement payé.
 *
 * L'engagement suit la décision : exonérer libère le budget immobilisé — il
 * n'y a plus rien à garantir — et rétablir la facturation le réengage. Sans
 * cela, une campagne offerte bloquerait l'argent de l'annonceur pour rien.
 */
export async function setCampaignBillingExemption(input: {
  campaignId: string;
  exempt: boolean;
  adminId: string;
  reason?: string | null;
}) {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: input.campaignId },
    select: {
      id: true,
      name: true,
      status: true,
      advertiserId: true,
      totalBudgetCents: true,
      spentCents: true,
      billingExemptAt: true,
    },
  });
  if (!campaign) throw new CampaignError("Campagne introuvable.", 404);

  const alreadyExempt = Boolean(campaign.billingExemptAt);
  if (alreadyExempt === input.exempt) {
    return prisma.adCampaign.findUniqueOrThrow({ where: { id: campaign.id } });
  }

  const remaining = Math.max(0, campaign.totalBudgetCents - campaign.spentCents);
  const running = ["ACTIVE", "SCHEDULED", "PAUSED", "PAUSED_BUDGET"].includes(campaign.status);

  let status = campaign.status;
  let pausedReason: string | null | undefined;

  if (input.exempt) {
    await releaseCampaignBudget({
      advertiserId: campaign.advertiserId,
      campaignId: campaign.id,
      amountCents: remaining,
      label: `Diffusion offerte — ${campaign.name}`,
    });
    // Une campagne arrêtée faute de solde n'a plus de raison de l'être : elle
    // ne coûte plus rien.
    if (campaign.status === "PAUSED_INSUFFICIENT_FUNDS") {
      status = "ACTIVE";
      pausedReason = null;
    }
  } else if (running) {
    try {
      await reserveCampaignBudget({
        advertiserId: campaign.advertiserId,
        campaignId: campaign.id,
        amountCents: remaining,
        label: `Reprise de facturation — ${campaign.name}`,
      });
    } catch (e) {
      if (!(e instanceof WalletError)) throw e;
      // Facturation rétablie sans solde en face : la campagne s'arrête au lieu
      // de diffuser à crédit. L'annonceur voit pourquoi et peut recharger.
      status = "PAUSED_INSUFFICIENT_FUNDS";
      pausedReason = "Facturation rétablie — rechargez pour reprendre la diffusion";
    }
  }

  const updated = await prisma.adCampaign.update({
    where: { id: campaign.id },
    data: {
      status,
      ...(pausedReason === undefined ? {} : { pausedReason }),
      billingExemptAt: input.exempt ? new Date() : null,
      billingExemptReason: input.exempt ? (input.reason?.trim() || null) : null,
      billingExemptBy: input.exempt ? input.adminId : null,
    },
  });

  invalidateAdCache();
  invalidateExemptCache(campaign.id);
  return updated;
}

/**
 * Arrêt et reprise à la main de l'annonceur.
 *
 * Volontairement distinct des arrêts automatiques : `PAUSED` est une décision,
 * `PAUSED_BUDGET` et `PAUSED_INSUFFICIENT_FUNDS` sont des constats. Les
 * confondre empêcherait de savoir s'il faut relancer la campagne ou recharger
 * le portefeuille.
 */
export async function pauseCampaign(advertiserId: string, campaignId: string) {
  const campaign = await prisma.adCampaign.findFirst({
    where: { id: campaignId, advertiserId },
    select: { id: true, status: true },
  });
  if (!campaign) throw new CampaignError("Campagne introuvable.", 404);
  if (!["ACTIVE", "SCHEDULED", "PAUSED_BUDGET"].includes(campaign.status)) {
    throw new CampaignError("Cette campagne ne diffuse pas.", 409);
  }

  const updated = await prisma.adCampaign.update({
    where: { id: campaign.id },
    data: { status: "PAUSED", pausedReason: "Mise en pause par l'annonceur" },
  });
  invalidateAdCache();
  return updated;
}

export async function resumeCampaign(advertiserId: string, campaignId: string) {
  const campaign = await prisma.adCampaign.findFirst({
    where: { id: campaignId, advertiserId },
    select: {
      id: true,
      name: true,
      status: true,
      startAt: true,
      endAt: true,
      spentCents: true,
      totalBudgetCents: true,
      billingExemptAt: true,
    },
  });
  if (!campaign) throw new CampaignError("Campagne introuvable.", 404);
  if (!["PAUSED", "PAUSED_INSUFFICIENT_FUNDS"].includes(campaign.status)) {
    throw new CampaignError("Cette campagne n'est pas en pause.", 409);
  }
  if (campaign.endAt <= new Date()) {
    throw new CampaignError("Cette campagne est arrivée à son terme.", 409);
  }
  if (campaign.spentCents >= campaign.totalBudgetCents) {
    throw new CampaignError("Le budget total est consommé.", 409);
  }

  if (!campaign.billingExemptAt) {
    // Le budget restant est réengagé à la reprise : entre-temps, l'annonceur a
    // pu le promettre à une autre campagne.
    await reserveCampaignBudget({
      advertiserId,
      campaignId: campaign.id,
      amountCents: Math.max(0, campaign.totalBudgetCents - campaign.spentCents),
      label: `Reprise — ${campaign.name}`,
    });
  }

  const updated = await prisma.adCampaign.update({
    where: { id: campaign.id },
    data: {
      status: campaign.startAt <= new Date() ? "ACTIVE" : "SCHEDULED",
      pausedReason: null,
    },
  });
  invalidateAdCache();
  return updated;
}

/**
 * Archivage : la campagne quitte les listes actives sans rien effacer.
 *
 * Supprimer une campagne effacerait l'explication de dépenses déjà facturées.
 * On archive, on libère l'engagement, et l'historique reste consultable.
 */
export async function archiveCampaign(advertiserId: string, campaignId: string) {
  const campaign = await prisma.adCampaign.findFirst({
    where: { id: campaignId, advertiserId },
    select: { id: true, status: true },
  });
  if (!campaign) throw new CampaignError("Campagne introuvable.", 404);
  if (campaign.status === "ARCHIVED") return campaign;

  await stopCampaign(campaign.id, "ARCHIVED", "Archivée par l'annonceur");
  return prisma.adCampaign.findUniqueOrThrow({ where: { id: campaign.id } });
}

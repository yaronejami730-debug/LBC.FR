/**
 * Consommation du budget.
 *
 * Le principe tient en une phrase : **un événement facturable coûte au moment
 * où il est validé**, jamais en fin de journée. Une facturation différée laisse
 * une campagne dépasser son plafond pendant des heures — et c'est l'annonceur
 * qui découvre l'écart sur sa facture.
 *
 * Ce qui coûte dépend du modèle de la campagne, lui-même déduit de son
 * objectif :
 *
 *  - **CPC** (visites, contacts, réservations, annonce) : l'impression visible
 *    ne coûte rien, le clic validé coûte le prix dégagé par l'enchère ;
 *  - **CPM** (visibilité) : le clic ne coûte rien, l'impression **visible**
 *    coûte un millième du prix. Une publicité chargée mais jamais atteinte ne
 *    coûte rien du tout, dans les deux cas.
 *
 * Trois plafonds, trois effets :
 *
 *  - **budget total atteint** → `ENDED`, et l'engagement résiduel est libéré ;
 *  - **budget du jour atteint** → `PAUSED_BUDGET`. La campagne repart seule
 *    demain, le cron s'en charge ;
 *  - **portefeuille vide** → `PAUSED_INSUFFICIENT_FUNDS`, sur toutes les
 *    campagnes de l'annonceur. Elles repartent à la première recharge.
 *
 * Aucun de ces trois états n'est décidé par le navigateur : il signale un
 * événement, le serveur décide s'il est valide, ce qu'il coûte, et ce qu'il
 * déclenche.
 */
import { prisma } from "@/lib/prisma";
import { invalidateAdCache } from "./engine";
import { debitForSpend, releaseCampaignBudget } from "./wallet";
import type { BillingModel } from "./auction";

export type PricingRow = {
  placement: string;
  model: string;
  priceCents: number;
  floorCpcCents: number;
  floorCpmCents: number;
  isOpen: boolean;
};

let pricingCache: { at: number; rows: Map<string, PricingRow> } | null = null;
const PRICING_TTL_MS = 60_000;

/** Grille tarifaire, relue une fois par minute. */
export async function pricing(): Promise<Map<string, PricingRow>> {
  if (pricingCache && Date.now() - pricingCache.at < PRICING_TTL_MS) return pricingCache.rows;

  const rows = await prisma.adPlacementPricing.findMany();
  const map = new Map(rows.map((r) => [r.placement, r as PricingRow]));
  pricingCache = { at: Date.now(), rows: map };
  return map;
}

export function invalidatePricingCache(): void {
  pricingCache = null;
}

/** Planchers par défaut, quand un emplacement n'a pas encore de ligne de grille. */
export const DEFAULT_FLOORS = { cpcCents: 15, cpmCents: 200 };

/**
 * Planchers d'un emplacement.
 *
 * Sans ligne de grille, l'emplacement retombe sur les valeurs par défaut plutôt
 * que sur zéro : un plancher manquant brade l'inventaire silencieusement, ce
 * qui est bien pire qu'un prix mal réglé et visible.
 */
export function floorsOf(row: PricingRow | undefined): { cpcCents: number; cpmCents: number } {
  if (!row) return { ...DEFAULT_FLOORS };
  return {
    cpcCents: row.floorCpcCents > 0 ? row.floorCpcCents : DEFAULT_FLOORS.cpcCents,
    cpmCents: row.floorCpmCents > 0 ? row.floorCpmCents : DEFAULT_FLOORS.cpmCents,
  };
}

/**
 * Modèle de facturation d'un objectif.
 *
 * C'est ici que l'objectif cesse d'être un mot dans un formulaire : la
 * visibilité s'achète à l'impression visible, tout le reste au clic. Un
 * annonceur qui veut des visites ne paie donc rien tant que personne ne vient.
 */
export function modelForObjective(objective: string): BillingModel {
  return objective === "VISIBILITE" ? "CPM" : "CPC";
}

/**
 * Tarif de repli des campagnes créées avant les enchères.
 *
 * Elles n'ont pas de plafond à elles : les faire perdre toutes les enchères
 * serait une rupture de service, leur donner un plafond arbitraire serait
 * inventer un engagement qu'elles n'ont pas pris. On les fait donc enchérir au
 * tarif de la grille, celui auquel elles ont été vendues.
 */
export function legacyBidCents(model: BillingModel, row: PricingRow | undefined): number {
  if (!row) return model === "CPM" ? 300 : 25;
  if (row.model === model) return row.priceCents;
  return model === "CPM" ? Math.max(row.priceCents * 10, 200) : Math.max(row.priceCents, 15);
}

/** Début de la journée courante, heure de Paris — le fuseau de la facturation. */
export function startOfDayParis(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZoneName: "longOffset",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const offset = get("timeZoneName").replace("GMT", "") || "+00:00";
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00${offset}`);
}

/**
 * Dépense du jour d'une campagne, lue sur ses événements validés.
 *
 * Pas de colonne « dépensé aujourd'hui » : elle demanderait une remise à zéro
 * nocturne, donc un cron de plus et un bug de plus le jour où il ne tourne pas.
 */
export async function spentToday(campaignId: string): Promise<number> {
  const agg = await prisma.adEvent.aggregate({
    where: {
      campaignId,
      billingStatus: "BILLED",
      createdAt: { gte: startOfDayParis() },
    },
    _sum: { costCents: true },
  });
  return agg._sum.costCents ?? 0;
}

export type ChargeResult = {
  costCents: number;
  /** La campagne a-t-elle été arrêtée par ce débit ? */
  stopped: null | "ENDED" | "PAUSED_BUDGET" | "PAUSED_INSUFFICIENT_FUNDS";
};

/**
 * Impute le coût d'un événement à sa campagne et au portefeuille.
 *
 * Appelée après l'écriture de l'événement, jamais avant : on ne facture que ce
 * qui a survécu à la déduplication **et** au contrôle anti-fraude. Le débit
 * porte l'identifiant de l'événement comme clé d'idempotence — un événement,
 * un débit, quoi qu'il arrive au réseau.
 */
export async function chargeEvent(input: {
  campaignId: string;
  adEventId: string;
  costCents: number;
}): Promise<ChargeResult> {
  if (input.costCents <= 0) return { costCents: 0, stopped: null };

  const campaign = await prisma.adCampaign.update({
    where: { id: input.campaignId },
    data: { spentCents: { increment: input.costCents } },
    select: {
      id: true,
      name: true,
      spentCents: true,
      totalBudgetCents: true,
      dailyBudgetCents: true,
      status: true,
      advertiserId: true,
      advertiser: { select: { balanceCents: true, reservedCents: true, billingDisabledAt: true } },
    },
  });

  await debitForSpend({
    advertiserId: campaign.advertiserId,
    campaignId: campaign.id,
    adEventId: input.adEventId,
    costCents: input.costCents,
    label: `Diffusion — ${campaign.name}`,
  });

  // Le coût est écrit ici, et nulle part ailleurs : c'est cette colonne que lit
  // la dépense du jour. La laisser à la charge de l'appelant, c'était deux
  // endroits pour un même fait — et un plafond quotidien qui ne se déclenche
  // pas quand l'un des deux est oublié.
  await prisma.adEvent.update({
    where: { id: input.adEventId },
    data: { costCents: input.costCents, billingStatus: "BILLED" },
  });

  // ── Budget total ─────────────────────────────────────────────────────────
  if (campaign.spentCents >= campaign.totalBudgetCents && campaign.status === "ACTIVE") {
    await stopCampaign(campaign.id, "ENDED", "Budget total atteint");
    return { costCents: input.costCents, stopped: "ENDED" };
  }

  // ── Portefeuille ─────────────────────────────────────────────────────────
  const balanceAfter = campaign.advertiser.balanceCents - input.costCents;
  if (!campaign.advertiser.billingDisabledAt && balanceAfter <= 0) {
    await pauseAdvertiserCampaigns(campaign.advertiserId);
    return { costCents: input.costCents, stopped: "PAUSED_INSUFFICIENT_FUNDS" };
  }

  // ── Plafond du jour ──────────────────────────────────────────────────────
  const today = await spentToday(campaign.id);
  if (today >= campaign.dailyBudgetCents && campaign.status === "ACTIVE") {
    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "PAUSED_BUDGET",
        dailyCapAt: new Date(),
        pausedReason: "Budget du jour atteint — reprise automatique demain",
      },
    });
    invalidateAdCache();
    return { costCents: input.costCents, stopped: "PAUSED_BUDGET" };
  }

  return { costCents: input.costCents, stopped: null };
}

/**
 * Arrête une campagne et libère ce qui restait engagé.
 *
 * Une campagne terminée dont le budget reste réservé bloque l'argent de
 * l'annonceur sans rien lui donner en échange : la libération fait partie de
 * l'arrêt, elle n'est pas une tâche de nettoyage.
 */
export async function stopCampaign(
  campaignId: string,
  status: "ENDED" | "PAUSED" | "PAUSED_BUDGET" | "PAUSED_INSUFFICIENT_FUNDS" | "ARCHIVED",
  reason: string,
): Promise<void> {
  const campaign = await prisma.adCampaign.update({
    where: { id: campaignId },
    data: { status, pausedReason: reason },
    select: {
      id: true,
      name: true,
      advertiserId: true,
      spentCents: true,
      totalBudgetCents: true,
    },
  });

  // Seul un arrêt définitif libère : une pause budgétaire du jour garde
  // l'engagement, puisque la campagne repart demain.
  if (status === "ENDED" || status === "ARCHIVED") {
    await releaseCampaignBudget({
      advertiserId: campaign.advertiserId,
      campaignId: campaign.id,
      amountCents: Math.max(0, campaign.totalBudgetCents - campaign.spentCents),
      label: `Fin de campagne — ${campaign.name}`,
    });
  }

  invalidateAdCache();
}

/**
 * Suspend toutes les campagnes d'un annonceur à sec.
 *
 * Au niveau de l'annonceur et non de la campagne : le portefeuille est commun,
 * et laisser tourner les autres campagnes reviendrait à diffuser à crédit.
 */
export async function pauseAdvertiserCampaigns(advertiserId: string): Promise<number> {
  const { count } = await prisma.adCampaign.updateMany({
    where: { advertiserId, status: { in: ["ACTIVE", "PAUSED_BUDGET"] } },
    data: {
      status: "PAUSED_INSUFFICIENT_FUNDS",
      pausedReason: "Portefeuille épuisé — rechargez pour reprendre la diffusion",
    },
  });
  if (count > 0) invalidateAdCache();
  return count;
}

/**
 * Relance ce qui avait été suspendu faute de solde.
 *
 * Appelée après une recharge. Une campagne dont la date de fin est passée ne
 * repart pas : elle est terminée, la recharge n'y change rien.
 */
export async function resumeAdvertiserCampaigns(advertiserId: string): Promise<number> {
  const now = new Date();
  const { count } = await prisma.adCampaign.updateMany({
    where: {
      advertiserId,
      status: "PAUSED_INSUFFICIENT_FUNDS",
      endAt: { gte: now },
    },
    data: { status: "ACTIVE", pausedReason: null },
  });
  if (count > 0) invalidateAdCache();
  return count;
}

/**
 * La campagne peut-elle encore être servie aujourd'hui ?
 *
 * Vérifié au moment de servir, pas seulement à l'écriture de l'événement :
 * c'est ce qui empêche de dépasser le plafond du jour au lieu de le constater.
 */
export async function withinDailyBudget(campaign: {
  id: string;
  dailyBudgetCents: number;
}): Promise<boolean> {
  const today = await spentToday(campaign.id);
  return today < campaign.dailyBudgetCents;
}

/**
 * Consommation du budget.
 *
 * Le principe tient en une phrase : **un événement facturable coûte au moment
 * où il est écrit**, jamais en fin de journée. Une facturation différée laisse
 * une campagne dépasser son plafond pendant des heures — et c'est l'annonceur
 * qui découvre l'écart sur sa facture.
 *
 * Deux plafonds, deux effets :
 *
 *  - **budget total atteint** → la campagne passe en `ENDED`. Elle a été
 *    servie jusqu'au bout, il n'y a rien à reprendre ;
 *  - **budget du jour atteint** → la campagne cesse d'être servie jusqu'à
 *    minuit, mais garde son statut `ACTIVE`. Elle reprendra demain sans
 *    intervention.
 *
 * Le second n'est pas un statut mais un calcul : la dépense du jour se lit sur
 * les événements. Une colonne « dépensé aujourd'hui » aurait demandé une remise
 * à zéro nocturne, donc un cron de plus et un bug de plus le jour où il ne
 * tourne pas.
 */
import { prisma } from "@/lib/prisma";
import { invalidateAdCache } from "./engine";
import { debitForSpend } from "./wallet";

export type PricingRow = { placement: string; model: string; priceCents: number; isOpen: boolean };

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

/**
 * Coût d'un événement, en centimes.
 *
 * En CPC, l'impression est gratuite et le clic coûte le prix affiché. En CPM,
 * c'est l'inverse : mille impressions coûtent le prix, donc une impression
 * vaut un millième — arrondi au centime supérieur pour ne jamais facturer zéro
 * une impression réellement servie.
 */
export function eventCost(
  type: "IMPRESSION" | "CLICK" | "CONVERSION",
  row: PricingRow | undefined,
): number {
  if (!row) return 0;
  if (row.model === "CPM") return type === "IMPRESSION" ? Math.ceil(row.priceCents / 1000) : 0;
  if (row.model === "CPC") return type === "CLICK" ? row.priceCents : 0;
  return 0;
}

/** Début de la journée courante, heure de Paris — le fuseau de la facturation. */
function startOfDayParis(now = new Date()): Date {
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  paris.setHours(0, 0, 0, 0);
  // Retour vers l'instant absolu correspondant.
  const offset = now.getTime() - new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" })).getTime();
  return new Date(paris.getTime() + offset);
}

/** Dépense du jour d'une campagne, lue sur ses événements. */
export async function spentToday(campaignId: string): Promise<number> {
  const agg = await prisma.adEvent.aggregate({
    where: { campaignId, createdAt: { gte: startOfDayParis() } },
    _sum: { costCents: true },
  });
  return agg._sum.costCents ?? 0;
}

/**
 * Impute le coût d'un événement à sa campagne.
 *
 * Appelée après l'écriture de l'événement, jamais avant : on ne facture que ce
 * qui a survécu à la déduplication.
 */
export async function chargeEvent(input: {
  campaignId: string;
  costCents: number;
}): Promise<{ exhausted: boolean }> {
  if (input.costCents <= 0) return { exhausted: false };

  const campaign = await prisma.adCampaign.update({
    where: { id: input.campaignId },
    data: { spentCents: { increment: input.costCents } },
    select: {
      id: true,
      name: true,
      spentCents: true,
      totalBudgetCents: true,
      status: true,
      advertiserId: true,
    },
  });

  // Deux compteurs, deux questions : ce que cette campagne a coûté, et ce
  // qu'il reste à l'annonceur. Le second est ce qui arrête la diffusion quand
  // le portefeuille est vide.
  await debitForSpend({
    advertiserId: campaign.advertiserId,
    campaignId: campaign.id,
    costCents: input.costCents,
    label: `Diffusion — ${campaign.name}`,
  });

  if (campaign.spentCents >= campaign.totalBudgetCents && campaign.status === "ACTIVE") {
    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: { status: "ENDED", pausedReason: "Budget total atteint" },
    });
    // Sans purge, le moteur continuerait de la servir jusqu'à trente secondes.
    invalidateAdCache();
    return { exhausted: true };
  }

  return { exhausted: false };
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

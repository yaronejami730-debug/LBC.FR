import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateAdCache } from "@/lib/ads/engine";
import { spentToday, stopCampaign } from "@/lib/ads/billing";
import { flushAuctionStats } from "@/lib/ads/auction-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cycle de vie des campagnes, au quart d'heure.
 *
 * Quatre transitions qu'aucun clic ne déclenchera jamais tout seul :
 *
 *  - **programmée → active**, quand la date de début est atteinte. L'admin qui
 *    valide une campagne pour le 1er du mois n'a pas à revenir cliquer ce
 *    jour-là ;
 *  - **active → terminée**, quand la date de fin est passée. L'engagement
 *    résiduel est libéré : sans cela, le budget non consommé resterait
 *    immobilisé et l'annonceur ne pourrait pas le réutiliser ;
 *  - **plafond du jour → active**, au passage de minuit. C'est la contrepartie
 *    du statut `PAUSED_BUDGET` : il ne serait pas tenable s'il fallait
 *    intervenir à la main chaque matin ;
 *  - **écriture des compteurs d'enchères** restés en mémoire.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // ── Programmées dont l'heure est venue ───────────────────────────────────
  const { count: started } = await prisma.adCampaign.updateMany({
    where: { status: "SCHEDULED", startAt: { lte: now }, endAt: { gt: now } },
    data: { status: "ACTIVE", pausedReason: null },
  });

  // ── Arrivées à leur terme ────────────────────────────────────────────────
  const expired = await prisma.adCampaign.findMany({
    where: {
      status: { in: ["ACTIVE", "SCHEDULED", "PAUSED_BUDGET", "PAUSED_INSUFFICIENT_FUNDS"] },
      endAt: { lte: now },
    },
    select: { id: true },
    take: 500,
  });
  for (const campaign of expired) {
    await stopCampaign(campaign.id, "ENDED", "Date de fin atteinte");
  }

  // ── Plafond du jour : reprise ────────────────────────────────────────────
  // On revérifie la dépense du jour plutôt que de faire confiance à l'heure :
  // le cron peut tourner en retard, et une campagne dont le plafond vient
  // d'être relevé doit repartir sans attendre minuit.
  const capped = await prisma.adCampaign.findMany({
    where: { status: "PAUSED_BUDGET", endAt: { gt: now } },
    select: { id: true, dailyBudgetCents: true },
    take: 500,
  });
  let resumed = 0;
  for (const campaign of capped) {
    if ((await spentToday(campaign.id)) < campaign.dailyBudgetCents) {
      await prisma.adCampaign.update({
        where: { id: campaign.id },
        data: { status: "ACTIVE", pausedReason: null, dailyCapAt: null },
      });
      resumed++;
    }
  }

  await flushAuctionStats().catch(() => null);
  invalidateAdCache();

  return NextResponse.json({ started, ended: expired.length, resumed, checkedAt: now });
}

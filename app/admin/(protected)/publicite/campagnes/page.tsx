import { prisma } from "@/lib/prisma";
import CampaignModeration, { type ModeratedCampaign } from "./CampaignModeration";

export const metadata = { title: "Campagnes — Deal&Co Ads" };
export const dynamic = "force-dynamic";

/**
 * File de modération des campagnes.
 *
 * Les campagnes en attente d'abord : c'est le seul endroit où quelqu'un attend
 * une réponse. Le reste sert de contexte — savoir ce qui tourne aide à juger
 * ce qui arrive.
 */
export default async function AdminCampaignsPage() {
  const rows = await prisma.adCampaign.findMany({
    orderBy: [{ submittedAt: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      advertiser: { select: { company: true, firstName: true, lastName: true, email: true } },
      zones: { select: { label: true, radiusKm: true } },
      placements: { select: { placement: true } },
      ads: {
        select: { title: true, description: true, imageUrl: true, ctaLabel: true, destinationUrl: true },
      },
    },
  });

  const campaigns: ModeratedCampaign[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    objective: c.objective,
    status: c.status,
    startAt: c.startAt.toISOString(),
    endAt: c.endAt.toISOString(),
    dailyBudgetCents: c.dailyBudgetCents,
    totalBudgetCents: c.totalBudgetCents,
    spentCents: c.spentCents,
    reviewNote: c.reviewNote,
    billingExemptAt: c.billingExemptAt?.toISOString() ?? null,
    billingExemptReason: c.billingExemptReason,
    maxBidCents: c.maxBidCents,
    billingModel: c.billingModel,
    qualityScore: c.qualityScore,
    advertiser: c.advertiser.company || `${c.advertiser.firstName} ${c.advertiser.lastName}`,
    email: c.advertiser.email,
    zones: c.zones,
    placements: c.placements.map((p) => p.placement),
    ad: c.ads[0] ?? null,
  }));

  const pending = campaigns.filter((c) => c.status === "PENDING_REVIEW");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2f6fb8]">Publicité</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Campagnes</h1>
        <p className="text-sm text-slate-500 mt-1">
          {pending.length > 0
            ? `${pending.length} campagne(s) attendent une décision.`
            : "Aucune campagne en attente."}
        </p>
      </header>

      <CampaignModeration
        pending={pending}
        others={campaigns.filter((c) => c.status !== "PENDING_REVIEW")}
      />
    </div>
  );
}

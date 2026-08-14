import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveAdvertiser } from "@/lib/ads/advertiser-auth";
import { CAMPAIGN_STATUSES, objectiveLabel, placementLabel } from "@/lib/ads/placements";
import AdvertiserShell, { COLORS } from "../AdvertiserShell";

export const dynamic = "force-dynamic";

const euros = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const day = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

/** Un statut se lit à sa couleur avant de se lire à son mot. */
const TONE: Record<string, { bg: string; fg: string }> = {
  ACTIVE: { bg: "#DCFCE7", fg: "#15803D" },
  SCHEDULED: { bg: "#DCE8FF", fg: "#1D4ED8" },
  PENDING_REVIEW: { bg: "#FEF3C7", fg: "#B45309" },
  REJECTED: { bg: "#FEE2E2", fg: "#B91C1C" },
  DRAFT: { bg: "#F1F5FC", fg: "#64748B" },
  PAUSED: { bg: "#F1F5FC", fg: "#64748B" },
  ENDED: { bg: "#F1F5FC", fg: "#64748B" },
};

/** Campagnes de l'annonceur. */
export default async function AdvertiserCampaignsPage() {
  const advertiser = await requireActiveAdvertiser();
  if (!advertiser) redirect("/annonceur/connexion");
  if (advertiser.mustChangePassword) redirect("/annonceur/mot-de-passe");

  const campaigns = await prisma.adCampaign.findMany({
    where: { advertiserId: advertiser.id },
    orderBy: { createdAt: "desc" },
    include: {
      zones: { select: { label: true, radiusKm: true } },
      placements: { select: { placement: true } },
    },
  });

  return (
    <AdvertiserShell
      title="Campagnes"
      subtitle={`${campaigns.length} campagne${campaigns.length > 1 ? "s" : ""} au total`}
      advertiserName={advertiser.company || `${advertiser.firstName} ${advertiser.lastName}`}
      contactName={`${advertiser.firstName} ${advertiser.lastName}`}
      current="/annonceur/campagnes"
      action={{ href: "/annonceur/campagnes/nouvelle", label: "Nouvelle campagne" }}
    >
      <div className="space-y-4 max-w-4xl">

        {campaigns.length === 0 ? (
          <div className="rounded-[18px] bg-white p-10 text-center" style={{ border: `1px solid ${COLORS.line}` }}>
            <span className="material-symbols-outlined text-[32px] text-[#94A3B8]">campaign</span>
            <p className="mt-2 font-bold">Aucune campagne pour l&apos;instant</p>
            <p className="mt-1 text-sm text-[#94A3B8] max-w-sm mx-auto leading-relaxed">
              Choisissez votre objectif, la zone où diffuser et votre budget. Vous verrez votre
              publicité avant de la lancer.
            </p>
            <Link
              href="/annonceur/campagnes/nouvelle"
              className="mt-5 inline-block rounded-xl px-6 py-2.5 text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.blueLight})` }}
            >
              Créer ma première campagne
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {campaigns.map((c) => (
              <li key={c.id} className="rounded-[18px] bg-white p-5" style={{ border: `1px solid ${COLORS.line}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-extrabold truncate">{c.name}</p>
                    <p className="text-xs text-[#94A3B8]">
                      {objectiveLabel(c.objective)} · {day(c.startAt)} → {day(c.endAt)}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={TONE[c.status] ? { background: TONE[c.status].bg, color: TONE[c.status].fg } : undefined}
                  >
                    {CAMPAIGN_STATUSES[c.status as keyof typeof CAMPAIGN_STATUSES] ?? c.status}
                  </span>
                </div>

                {/* Un refus sans motif visible est incompréhensible : on le
                    montre là où l'annonceur regarde, pas seulement par e-mail. */}
                {c.status === "REJECTED" && c.reviewNote && (
                  <p className="mt-3 rounded-xl px-3 py-2 text-xs" style={{ background: "#FEE2E2", color: "#B91C1C" }}>
                    <strong>Motif :</strong> {c.reviewNote}
                  </p>
                )}

                <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Budget</dt>
                    <dd className="tabular-nums">{euros(c.dailyBudgetCents)}/j</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Dépensé</dt>
                    <dd className="tabular-nums">
                      {euros(c.spentCents)} <span className="text-[#94A3B8]">/ {euros(c.totalBudgetCents)}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Zones</dt>
                    <dd className="truncate">
                      {c.zones.length === 0
                        ? "France entière"
                        : c.zones.map((z) => z.label).join(", ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Emplacements</dt>
                    <dd className="truncate">{c.placements.map((p) => placementLabel(p.placement)).join(", ")}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdvertiserShell>
  );
}

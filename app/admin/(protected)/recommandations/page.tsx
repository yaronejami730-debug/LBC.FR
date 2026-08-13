/**
 * Écran d'administration du moteur de recommandation locale.
 *
 * Trois choses à y lire, dans cet ordre : est-ce que la matière première est
 * là (annonces géocodées, comptes avec une zone), qu'est-ce que les dernières
 * campagnes ont produit, et qu'est-ce que la prochaine ferait si on la lançait.
 */

import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { RECO_CONFIG } from "@/lib/recommendations/config";
import { activeCategories } from "@/lib/recommendations/engine";
import { listingUrl } from "@/lib/listing-slug";
import SimulationPanel from "./SimulationPanel";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

function percent(part: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((part / total) * 100)} %`;
}

export default async function RecommandationsPage() {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RECO_CONFIG.freshnessDays * DAY_MS);
  const last30 = new Date(now.getTime() - 30 * DAY_MS);

  const [
    listingsTotal,
    listingsGeocoded,
    listingsUnresolvable,
    zonesCertain,
    zonesEstimated,
    usersWithZone,
    usersWithInterest,
    campaigns,
    fresh,
    topClicked,
  ] = await Promise.all([
    prisma.listing.count({ where: { deletedAt: null, status: "APPROVED" } }),
    prisma.listing.count({ where: { deletedAt: null, status: "APPROVED", geoLat: { not: null } } }),
    prisma.listing.count({
      where: { deletedAt: null, status: "APPROVED", geoResolvedAt: { not: null }, geoLat: null },
    }),
    prisma.userLocationProfile.count({ where: { certainty: "CERTAIN" } }),
    prisma.userLocationProfile.count({ where: { certainty: "ESTIMATED" } }),
    prisma.userLocationProfile.findMany({ distinct: ["userId"], select: { userId: true } }),
    prisma.userCategoryInterest.findMany({ distinct: ["userId"], select: { userId: true } }),
    prisma.recommendationCampaign.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        id: true,
        categoryLabel: true,
        listingCount: true,
        candidateUsers: true,
        targetedUsers: true,
        emailsSent: true,
        errors: true,
        dryRun: true,
        status: true,
        startedAt: true,
      },
    }),
    activeCategories(windowStart),
    prisma.listingRecommendationLog.groupBy({
      by: ["listingId"],
      where: { clickedAt: { not: null }, createdAt: { gte: last30 } },
      _count: { _all: true },
      orderBy: { _count: { listingId: "desc" } },
      take: 8,
    }),
  ]);

  // Ouvertures et clics par campagne : les taux sont calculés sur les lignes
  // réellement envoyées, jamais sur les lignes simulées.
  const campaignIds = campaigns.map((c) => c.id);
  const engagement = campaignIds.length
    ? await prisma.listingRecommendationLog.groupBy({
        by: ["campaignId"],
        where: { campaignId: { in: campaignIds }, sentAt: { not: null } },
        _count: { _all: true },
      })
    : [];
  const opened = campaignIds.length
    ? await prisma.listingRecommendationLog.groupBy({
        by: ["campaignId"],
        where: { campaignId: { in: campaignIds }, openedAt: { not: null } },
        _count: { _all: true },
      })
    : [];
  const clicked = campaignIds.length
    ? await prisma.listingRecommendationLog.groupBy({
        by: ["campaignId"],
        where: { campaignId: { in: campaignIds }, clickedAt: { not: null } },
        _count: { _all: true },
      })
    : [];

  const sentByCampaign = new Map(engagement.map((e) => [e.campaignId, e._count._all]));
  const openByCampaign = new Map(opened.map((e) => [e.campaignId, e._count._all]));
  const clickByCampaign = new Map(clicked.map((e) => [e.campaignId, e._count._all]));

  const topListings = topClicked.length
    ? await prisma.listing.findMany({
        where: { id: { in: topClicked.map((t) => t.listingId) } },
        select: { id: true, title: true, location: true, price: true },
      })
    : [];
  const listingById = new Map(topListings.map((l) => [l.id, l]));

  const freshByLabel = new Map(fresh.map((f) => [f.label, f.count]));
  const categoryOptions = CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    freshCount: freshByLabel.get(c.label) ?? 0,
  })).sort((a, b) => b.freshCount - a.freshCount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#191c1e] font-headline">
          Recommandations locales
        </h1>
        <p className="text-sm text-[#777683] mt-1">
          Rayon {RECO_CONFIG.radiusKm} km · score minimal {RECO_CONFIG.minScore}/100 ·
          intérêt catégoriel minimal {RECO_CONFIG.minCategoryInterest}/100 ·
          {" "}un email par compte tous les {RECO_CONFIG.userThrottleDays} jours au plus,
          {" "}{RECO_CONFIG.categoryThrottleDays} jours par catégorie.
        </p>
      </div>

      {/* ── Matière première ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          label="Annonces géolocalisées"
          value={`${listingsGeocoded} / ${listingsTotal}`}
          hint={`${percent(listingsGeocoded, listingsTotal)} du catalogue en ligne`}
        />
        <Card
          label="Localisations illisibles"
          value={String(listingsUnresolvable)}
          hint="saisies qu'aucune commune ne permet de résoudre"
        />
        <Card
          label="Comptes localisés"
          value={String(usersWithZone.length)}
          hint={`${zonesCertain} zones certaines · ${zonesEstimated} estimées`}
        />
        <Card
          label="Comptes avec intérêt"
          value={String(usersWithInterest.length)}
          hint="au moins une catégorie notée"
        />
      </div>

      {listingsGeocoded === 0 && (
        <p className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3">
          Aucune annonce n&apos;est géolocalisée. Lancez{" "}
          <code className="font-mono">npm run reco:backfill-geo</code> avant la première campagne :
          sans coordonnées, le moteur n&apos;a rien à comparer et n&apos;enverra rien.
        </p>
      )}

      {/* ── Simulation ─────────────────────────────────────────────────── */}
      <SimulationPanel categories={categoryOptions} />

      {/* ── Campagnes ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#eceef0] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#eceef0]">
          <h2 className="font-bold text-[#191c1e]">Campagnes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f7fb] text-[#5a5b6e] text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Catégorie</th>
                <th className="text-right px-4 py-3">Annonces</th>
                <th className="text-right px-4 py-3">Examinés</th>
                <th className="text-right px-4 py-3">Ciblés</th>
                <th className="text-right px-4 py-3">Envoyés</th>
                <th className="text-right px-4 py-3">Ouverture</th>
                <th className="text-right px-4 py-3">Clic</th>
                <th className="text-right px-4 py-3">Erreurs</th>
                <th className="text-left px-4 py-3">État</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-[#777683]">
                    Aucune campagne. La première partira au prochain passage du planificateur.
                  </td>
                </tr>
              )}
              {campaigns.map((c) => {
                const sent = sentByCampaign.get(c.id) ?? 0;
                return (
                  <tr key={c.id} className="border-t border-[#eceef0]">
                    <td className="px-4 py-2 text-xs text-[#777683]">
                      {c.startedAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-2 font-semibold text-[#191c1e]">{c.categoryLabel}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.listingCount}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.candidateUsers}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.targetedUsers}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{c.emailsSent}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {percent(openByCampaign.get(c.id) ?? 0, sent)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {percent(clickByCampaign.get(c.id) ?? 0, sent)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.errors || "—"}</td>
                    <td className="px-4 py-2">
                      {c.dryRun ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                          simulation
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            c.status === "DONE"
                              ? "bg-green-100 text-green-800"
                              : c.status === "FAILED"
                                ? "bg-red-100 text-red-800"
                                : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {c.status === "DONE" ? "terminée" : c.status === "FAILED" ? "échec" : "en cours"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Annonces les plus cliquées ─────────────────────────────────── */}
      <div className="bg-white border border-[#eceef0] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#eceef0]">
          <h2 className="font-bold text-[#191c1e]">Annonces les plus cliquées (30 jours)</h2>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {topClicked.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-[#777683]">
                  Aucun clic enregistré pour l&apos;instant.
                </td>
              </tr>
            )}
            {topClicked.map((row) => {
              const listing = listingById.get(row.listingId);
              if (!listing) return null;
              return (
                <tr key={row.listingId} className="border-t border-[#eceef0]">
                  <td className="px-4 py-2">
                    <a
                      href={listingUrl(listing.id, listing.title)}
                      className="font-semibold text-[#191c1e] hover:underline"
                    >
                      {listing.title}
                    </a>
                    <div className="text-xs text-[#777683]">{listing.location}</div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                    {listing.price.toLocaleString("fr-FR")} €
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold whitespace-nowrap">
                    {row._count._all} clic{row._count._all > 1 ? "s" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-white border border-[#eceef0] rounded-xl p-4">
      <div className="text-xs uppercase text-[#5a5b6e] font-semibold">{label}</div>
      <div className="text-2xl font-extrabold text-[#191c1e] mt-1 tabular-nums">{value}</div>
      <div className="text-xs text-[#777683] mt-1">{hint}</div>
    </div>
  );
}

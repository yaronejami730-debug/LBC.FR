/**
 * Ce que l'inventaire a réellement produit, tenu à jour pour le moteur.
 *
 * L'enchère a besoin de trois choses que seule l'histoire connaît : le taux de
 * clic moyen du parc, celui de chaque créatif, et la part des affichages qui
 * atteignent vraiment l'écran, emplacement par emplacement. Sans elles, le
 * classement se ferait sur des constantes — c'est-à-dire sur rien.
 *
 * Ces chiffres bougent lentement : ils se lisent toutes les dix minutes, pas à
 * chaque publicité servie. Une régie qui interroge sa base à chaque affichage
 * tombe au premier pic de trafic, et un taux de clic recalculé toutes les
 * secondes ne dit rien de plus que le même recalculé au quart d'heure.
 */
import { prisma } from "@/lib/prisma";
import { DEFAULT_BASELINE_CTR } from "./quality-score";

export type PlacementPerformance = {
  /** Part des publicités chargées qui deviennent des impressions visibles. */
  viewabilityRate: number | null;
  ctr: number | null;
};

export type PerformanceSnapshot = {
  /** Taux de clic moyen de tout l'inventaire, sur la fenêtre d'observation. */
  baselineCtr: number;
  byPlacement: Map<string, PlacementPerformance>;
  byAd: Map<string, { ctr: number | null; viewableImpressions: number }>;
  /** Conversions par clic, par campagne — le signal de l'objectif « contacts ». */
  byCampaign: Map<string, { conversionRate: number | null }>;
  at: number;
};

const TTL_MS = 10 * 60_000;
const WINDOW_DAYS = 30;

let snapshot: PerformanceSnapshot | null = null;
let inflight: Promise<PerformanceSnapshot> | null = null;

const EMPTY: PerformanceSnapshot = {
  baselineCtr: DEFAULT_BASELINE_CTR,
  byPlacement: new Map(),
  byAd: new Map(),
  byCampaign: new Map(),
  at: 0,
};

/**
 * Instantané de performance, mis en cache dix minutes.
 *
 * Une seule requête en vol à la fois : sans ce garde, un redémarrage sous
 * trafic déclencherait autant de recalculs que de requêtes simultanées.
 */
export async function performanceSnapshot(): Promise<PerformanceSnapshot> {
  if (snapshot && Date.now() - snapshot.at < TTL_MS) return snapshot;
  if (inflight) return inflight;

  inflight = load()
    .then((s) => {
      snapshot = s;
      return s;
    })
    .catch(() => snapshot ?? EMPTY)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function invalidatePerformance(): void {
  snapshot = null;
}

async function load(): Promise<PerformanceSnapshot> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);

  // Les agrégats journaliers portent l'emplacement ; le détail par créatif se
  // lit sur les événements, mais seulement en comptage — jamais ligne à ligne.
  const [daily, byAdRows] = await Promise.all([
    prisma.adStatDaily.groupBy({
      by: ["placement"],
      where: { day: { gte: since } },
      _sum: { impressions: true, clicks: true, loads: true },
    }),
    prisma.adEvent.groupBy({
      by: ["adId", "type"],
      where: { createdAt: { gte: since }, validationStatus: "VALID" },
      _count: { _all: true },
    }),
  ]);

  const byPlacement = new Map<string, PlacementPerformance>();
  let totalViewable = 0;
  let totalClicks = 0;

  for (const row of daily) {
    const impressions = row._sum.impressions ?? 0;
    const clicks = row._sum.clicks ?? 0;
    const loads = row._sum.loads ?? 0;
    totalViewable += impressions;
    totalClicks += clicks;
    byPlacement.set(row.placement, {
      viewabilityRate: loads > 0 ? Math.min(1, impressions / loads) : null,
      ctr: impressions > 0 ? clicks / impressions : null,
    });
  }

  const adCounts = new Map<string, { viewable: number; clicks: number; conversions: number }>();
  for (const row of byAdRows) {
    const entry = adCounts.get(row.adId) ?? { viewable: 0, clicks: 0, conversions: 0 };
    const n = row._count._all;
    if (row.type === "VIEWABLE_IMPRESSION" || row.type === "IMPRESSION") entry.viewable += n;
    else if (row.type === "CLICK") entry.clicks += n;
    else if (row.type === "CONVERSION") entry.conversions += n;
    adCounts.set(row.adId, entry);
  }

  const byAd = new Map<string, { ctr: number | null; viewableImpressions: number }>();
  for (const [adId, c] of adCounts) {
    byAd.set(adId, {
      ctr: c.viewable > 0 ? c.clicks / c.viewable : null,
      viewableImpressions: c.viewable,
    });
  }

  // Conversions par campagne : lues sur les créatifs, car un objectif se juge
  // à l'échelle de la campagne, pas d'un visuel.
  const ads = await prisma.ad.findMany({ select: { id: true, campaignId: true } });
  const byCampaignCounts = new Map<string, { clicks: number; conversions: number }>();
  for (const ad of ads) {
    const c = adCounts.get(ad.id);
    if (!c) continue;
    const entry = byCampaignCounts.get(ad.campaignId) ?? { clicks: 0, conversions: 0 };
    entry.clicks += c.clicks;
    entry.conversions += c.conversions;
    byCampaignCounts.set(ad.campaignId, entry);
  }

  const byCampaign = new Map<string, { conversionRate: number | null }>();
  for (const [campaignId, c] of byCampaignCounts) {
    byCampaign.set(campaignId, { conversionRate: c.clicks > 0 ? c.conversions / c.clicks : null });
  }

  return {
    baselineCtr: totalViewable > 0 && totalClicks > 0 ? totalClicks / totalViewable : DEFAULT_BASELINE_CTR,
    byPlacement,
    byAd,
    byCampaign,
    at: Date.now(),
  };
}

/**
 * Multiplicateur d'optimisation lié à l'objectif de la campagne.
 *
 * C'est ici que l'objectif cesse d'être un libellé : il pèse sur le rang, donc
 * sur qui est servi.
 *
 *  - **visibilité** : les emplacements réellement vus remontent. Un annonceur
 *    qui achète de la visibilité n'a que faire d'un encart chargé en bas de
 *    page que personne n'atteint ;
 *  - **visites** : le taux de clic constaté de l'emplacement remonte ;
 *  - **contacts et réservations** : la campagne qui transforme ses clics en
 *    contacts remonte, même si elle en obtient moins.
 *
 * Toujours borné autour de 1 : l'optimisation corrige, elle ne remplace pas
 * l'enchère. Un annonceur doit rester maître de ce qu'il paie.
 */
export function objectiveMultiplier(input: {
  objective: string;
  placement: string;
  campaignId: string;
  snapshot: PerformanceSnapshot;
}): number {
  const placement = input.snapshot.byPlacement.get(input.placement);

  if (input.objective === "VISIBILITE") {
    const rate = placement?.viewabilityRate;
    if (rate === null || rate === undefined) return 1;
    // 70 % de visibilité est la référence : au-dessus on favorise, en dessous
    // on freine, dans une fourchette de ±20 %.
    return clamp(0.8 + (rate / 0.7) * 0.25, 0.8, 1.25);
  }

  if (input.objective === "VISITES" || input.objective === "ANNONCE") {
    const ctr = placement?.ctr;
    if (!ctr || ctr <= 0) return 1;
    return clamp(0.85 + (ctr / Math.max(input.snapshot.baselineCtr, 1e-6)) * 0.2, 0.85, 1.25);
  }

  if (input.objective === "CONTACTS" || input.objective === "RESERVATIONS") {
    const rate = input.snapshot.byCampaign.get(input.campaignId)?.conversionRate;
    if (rate === null || rate === undefined) return 1;
    // Un clic sur dix qui devient un contact est déjà bon : c'est la référence.
    return clamp(0.9 + (rate / 0.1) * 0.25, 0.9, 1.3);
  }

  return 1;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

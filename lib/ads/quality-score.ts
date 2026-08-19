/**
 * Score qualité d'un créatif.
 *
 * Sans lui, une enchère se résume à « le plus gros budget gagne », et
 * l'inventaire se remplit de publicités que personne ne clique : l'annonceur
 * paie, le visiteur subit, et la régie perd les deux. Le score est ce qui
 * permet à une bonne publicité moins chère de passer devant une mauvaise plus
 * chère.
 *
 * Deux principes, et ils comptent plus que la formule :
 *
 *  - **le score vient de données réelles.** Taux de clic constaté, part des
 *    affichages qui atteignent l'écran, part des événements écartés, validité
 *    de la destination. Rien qui soit saisi à la main, rien qui vienne d'un
 *    ressenti commercial ;
 *  - **une campagne neuve n'est pas punie.** Sans historique, elle part à 70 —
 *    un neutre assumé — et le score se déplace vers l'observé au fur et à
 *    mesure que les événements arrivent. Un créatif jugé sur trois impressions
 *    serait jugé sur du bruit.
 *
 * Le lissage est bayésien, ce qui est un grand mot pour une idée simple : tant
 * qu'on a peu de données, on croit surtout la moyenne du marché ; quand on en
 * a beaucoup, on croit surtout ce qu'on a vu.
 */
import { prisma } from "@/lib/prisma";

/** Score d'une campagne sans historique. Ni avantage, ni punition. */
export const NEUTRAL_QUALITY_SCORE = 70;
/** Planchers et plafonds : un score de 0 exclurait définitivement un créatif. */
export const MIN_QUALITY_SCORE = 25;
export const MAX_QUALITY_SCORE = 100;

/**
 * Poids de l'a priori, en impressions visibles.
 *
 * À 500 impressions, l'observé pèse la moitié. C'est l'ordre de grandeur à
 * partir duquel un taux de clic cesse d'être une anecdote.
 */
const PRIOR_STRENGTH = 500;

/** Taux de clic de référence, faute de mieux : 0,35 %, ordre de grandeur display. */
export const DEFAULT_BASELINE_CTR = 0.0035;

export type QualityInputs = {
  /** Impressions visibles constatées sur la fenêtre d'observation. */
  viewableImpressions: number;
  clicks: number;
  /** Publicités chargées : le dénominateur de la part réellement vue. */
  loads: number;
  /** Événements écartés (robots, doubles clics, visibilité insuffisante). */
  invalidEvents: number;
  /** Conversions constatées — un contact vaut plus qu'un clic. */
  conversions: number;
  /** Taux de clic moyen de l'inventaire sur la même période. */
  baselineCtr: number;
  /** Le créatif est-il complet : description, visuel large, appel à l'action ? */
  creativeComplete: boolean;
  /** La destination est-elle exploitable : annonce en ligne, ou URL https ? */
  destinationValid: boolean;
};

export type QualityBreakdown = {
  score: number;
  factors: {
    /** Part du score issue du taux de clic, rapportée à la moyenne. */
    ctr: number;
    /** Part du score issue de la visibilité réelle des affichages. */
    viewability: number;
    /** Part du score issue de la propreté du trafic. */
    validity: number;
    /** Part du score issue du soin apporté au créatif et à la destination. */
    craft: number;
  };
  observed: {
    ctr: number | null;
    viewabilityRate: number | null;
    invalidRate: number | null;
    conversionRate: number | null;
    sample: number;
  };
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Calcule le score à partir de mesures brutes.
 *
 * Fonction pure : elle ne lit ni la base, ni l'horloge. C'est ce qui la rend
 * testable, et c'est ce qui permet de répondre à « pourquoi 62 ? » avec un
 * calcul plutôt qu'avec une intuition.
 */
export function computeQualityScore(input: QualityInputs): QualityBreakdown {
  const impressions = Math.max(0, input.viewableImpressions);
  const baseline = input.baselineCtr > 0 ? input.baselineCtr : DEFAULT_BASELINE_CTR;

  const observedCtr = impressions > 0 ? input.clicks / impressions : null;
  const viewabilityRate = input.loads > 0 ? Math.min(1, impressions / input.loads) : null;
  const totalEvents = impressions + input.clicks + input.invalidEvents;
  const invalidRate = totalEvents > 0 ? input.invalidEvents / totalEvents : null;
  const conversionRate = input.clicks > 0 ? input.conversions / input.clicks : null;

  // Lissage : l'observé compte pour `impressions / (impressions + PRIOR)`, le
  // reste va à la moyenne du marché. Une campagne à 20 impressions garde donc
  // un score proche du neutre, quelle que soit sa chance du jour.
  const confidence = impressions / (impressions + PRIOR_STRENGTH);
  const smoothedCtr =
    observedCtr === null ? baseline : observedCtr * confidence + baseline * (1 - confidence);

  // Un taux de clic double de la moyenne vaut le maximum ; la moitié de la
  // moyenne vaut la moitié des points. Plafonné : une publicité cliquée dix
  // fois plus que la moyenne est généralement un accident de mesure, pas un
  // chef-d'œuvre.
  const ctrFactor = clamp(smoothedCtr / (baseline * 2), 0, 1);

  // La visibilité mesure autant l'emplacement que le créatif — c'est voulu :
  // un annonceur servi sur des encarts que personne n'atteint doit voir son
  // rang baisser, sinon la régie vend du vide en toute bonne conscience.
  const viewabilityFactor = viewabilityRate === null ? 0.6 : clamp(viewabilityRate / 0.7, 0, 1);

  // Trafic écarté : un créatif dont un cinquième des événements est rejeté
  // perd tout le facteur. La régie ne peut pas se contenter de ne pas facturer
  // ces événements — il faut aussi qu'ils cessent d'arriver.
  const validityFactor = invalidRate === null ? 1 : clamp(1 - invalidRate * 5, 0, 1);

  // Soin : deux points objectifs, vérifiables, non négociables. Une conversion
  // constatée les complète — c'est le seul signal qui dit que la destination
  // tient la promesse du créatif.
  const craftBase = (input.creativeComplete ? 0.5 : 0.2) + (input.destinationValid ? 0.4 : 0);
  const conversionBonus = conversionRate === null ? 0 : clamp(conversionRate * 2, 0, 0.1);
  const craftFactor = clamp(craftBase + conversionBonus, 0, 1);

  const weighted =
    ctrFactor * 0.4 + viewabilityFactor * 0.25 + validityFactor * 0.15 + craftFactor * 0.2;

  const score = Math.round(clamp(weighted * 100, MIN_QUALITY_SCORE, MAX_QUALITY_SCORE));

  return {
    score,
    factors: {
      ctr: Math.round(ctrFactor * 100),
      viewability: Math.round(viewabilityFactor * 100),
      validity: Math.round(validityFactor * 100),
      craft: Math.round(craftFactor * 100),
    },
    observed: {
      ctr: observedCtr,
      viewabilityRate,
      invalidRate,
      conversionRate,
      sample: impressions,
    },
  };
}

/** Score normalisé pour le calcul du rang : 0–1 plutôt que 0–100. */
export function normalizedQuality(score: number): number {
  return clamp(score, MIN_QUALITY_SCORE, MAX_QUALITY_SCORE) / 100;
}

// ── Recalcul périodique ─────────────────────────────────────────────────────

/** Fenêtre d'observation : un mois. Au-delà, un créatif a changé de contexte. */
const WINDOW_DAYS = 30;

export type RefreshResult = { ads: number; campaigns: number; baselineCtr: number };

/**
 * Recalcule les scores de tous les créatifs diffusables.
 *
 * Tourne une fois par jour. Pas à chaque événement : un score qui bouge à
 * chaque clic rendrait le classement instable et le prix imprévisible pour
 * l'annonceur, qui verrait son coût par clic changer sans avoir rien touché.
 */
export async function refreshQualityScores(): Promise<RefreshResult> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);

  const grouped = await prisma.adEvent.groupBy({
    by: ["adId", "type", "validationStatus"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });

  type Counts = {
    viewable: number;
    clicks: number;
    loads: number;
    conversions: number;
    invalid: number;
  };
  const byAd = new Map<string, Counts>();
  const bump = (adId: string): Counts => {
    const row = byAd.get(adId) ?? { viewable: 0, clicks: 0, loads: 0, conversions: 0, invalid: 0 };
    byAd.set(adId, row);
    return row;
  };

  for (const g of grouped) {
    const row = bump(g.adId);
    const n = g._count._all;
    if (g.validationStatus !== "VALID") {
      row.invalid += n;
      continue;
    }
    // `IMPRESSION` est l'ancien nom des impressions comptées avant la mesure de
    // visibilité : les ignorer effacerait l'historique des campagnes en cours.
    if (g.type === "VIEWABLE_IMPRESSION" || g.type === "IMPRESSION") row.viewable += n;
    else if (g.type === "CLICK") row.clicks += n;
    else if (g.type === "LOAD") row.loads += n;
    else if (g.type === "CONVERSION") row.conversions += n;
  }

  // Moyenne de l'inventaire : c'est à elle qu'un créatif est comparé, pas à un
  // chiffre de référence sorti d'un article de blog.
  let totalViewable = 0;
  let totalClicks = 0;
  for (const row of byAd.values()) {
    totalViewable += row.viewable;
    totalClicks += row.clicks;
  }
  const baselineCtr = totalViewable > 0 ? totalClicks / totalViewable : DEFAULT_BASELINE_CTR;

  const ads = await prisma.ad.findMany({
    where: { campaign: { status: { notIn: ["ARCHIVED", "REJECTED"] } } },
    select: {
      id: true,
      campaignId: true,
      description: true,
      imageUrlWide: true,
      ctaLabel: true,
      destinationUrl: true,
      listingId: true,
    },
  });

  // Destination : une annonce supprimée ou hors ligne casse la promesse du
  // créatif. On le vérifie ici plutôt que de croire l'annonceur sur parole.
  const listingIds = ads.map((a) => a.listingId).filter((v): v is string => Boolean(v));
  const liveListings = new Set(
    listingIds.length === 0
      ? []
      : (
          await prisma.listing.findMany({
            where: { id: { in: listingIds }, status: "APPROVED", deletedAt: null },
            select: { id: true },
          })
        ).map((l) => l.id),
  );

  const now = new Date();
  const perCampaign = new Map<string, number[]>();

  for (const ad of ads) {
    const counts = byAd.get(ad.id) ?? {
      viewable: 0,
      clicks: 0,
      loads: 0,
      conversions: 0,
      invalid: 0,
    };

    const breakdown = computeQualityScore({
      viewableImpressions: counts.viewable,
      clicks: counts.clicks,
      loads: counts.loads,
      invalidEvents: counts.invalid,
      conversions: counts.conversions,
      baselineCtr,
      creativeComplete:
        ad.description.trim().length >= 40 && Boolean(ad.imageUrlWide) && ad.ctaLabel.trim().length > 0,
      destinationValid: ad.listingId
        ? liveListings.has(ad.listingId)
        : /^https:\/\//i.test(ad.destinationUrl ?? ""),
    });

    await prisma.ad.update({
      where: { id: ad.id },
      data: {
        qualityScore: breakdown.score,
        qualityScoreAt: now,
        qualityFactors: JSON.stringify({ ...breakdown.factors, observed: breakdown.observed }),
      },
    });

    const list = perCampaign.get(ad.campaignId) ?? [];
    list.push(breakdown.score);
    perCampaign.set(ad.campaignId, list);
  }

  // Score de campagne : la moyenne de ses créatifs. Il ne sert qu'à l'affichage
  // — le classement se fait créatif par créatif, sinon un bon visuel porterait
  // un mauvais.
  for (const [campaignId, scores] of perCampaign) {
    const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    await prisma.adCampaign.update({
      where: { id: campaignId },
      data: { qualityScore: avg, qualityScoreAt: now },
    });
  }

  return { ads: ads.length, campaigns: perCampaign.size, baselineCtr };
}

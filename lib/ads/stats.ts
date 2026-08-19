/**
 * Agrégation et lecture des statistiques publicitaires.
 *
 * Deux mondes séparés, volontairement :
 *
 *  - `AdEvent` est la vérité, ligne par ligne. C'est lui qui permet de
 *    contester une facture, de recompter, de purger le détail à 90 jours ;
 *  - `AdStatDaily` est ce que lisent les écrans. Un tableau de bord qui
 *    parcourt tous les événements d'un mois à chaque chargement s'effondre au
 *    premier annonceur sérieux.
 *
 * Le roulement est **idempotent** : il recalcule chaque jour concerné à partir
 * des événements et écrase la ligne d'agrégat. Le rejouer deux fois donne le
 * même résultat, ce qui est la seule propriété qui compte pour une tâche
 * planifiée — un cron qui double les chiffres quand il tourne en retard est
 * pire que pas de cron du tout.
 */
import { prisma } from "@/lib/prisma";

/** Minuit, heure de Paris, du jour d'un instant donné. */
export function parisDay(at: Date): Date {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00.000Z`);
}

/**
 * Instant absolu du dernier minuit parisien.
 *
 * `parisDay` renvoie un repère de jour, pas un instant : il sert à ranger des
 * lignes d'agrégat. Pour interroger `AdEvent`, il faut le vrai bord de la
 * journée, décalage horaire compris — sinon la « journée » commence à 2 h du
 * matin en été et les chiffres du jour partent faux.
 */
function parisMidnightInstant(now = new Date()): Date {
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

export type RollupResult = { days: number; rows: number; events: number };

/**
 * Recalcule les agrégats des `sinceHours` dernières heures.
 *
 * On repart des événements plutôt que d'incrémenter : incrémenter suppose de
 * savoir ce qui a déjà été compté, donc un curseur, donc un état de plus à
 * maintenir juste. Recalculer une fenêtre courte coûte une agrégation SQL.
 */
export async function rollupAdStats(sinceHours = 48): Promise<RollupResult> {
  const since = new Date(Date.now() - sinceHours * 3600_000);

  const events = await prisma.adEvent.findMany({
    where: { createdAt: { gte: since } },
    select: {
      type: true,
      campaignId: true,
      placement: true,
      citySlug: true,
      costCents: true,
      validationStatus: true,
      createdAt: true,
    },
  });

  // Regroupement en mémoire : la fenêtre est courte, et une agrégation SQL par
  // quadruplet demanderait un `GROUP BY` sur une expression de fuseau horaire
  // que Prisma ne sait pas exprimer sans SQL brut.
  const buckets = new Map<
    string,
    {
      day: Date;
      campaignId: string;
      placement: string;
      citySlug: string;
      impressions: number;
      loads: number;
      renders: number;
      clicks: number;
      conversions: number;
      invalidEvents: number;
      costCents: number;
    }
  >();

  for (const e of events) {
    const day = parisDay(e.createdAt);
    const city = e.citySlug ?? "";
    const key = `${day.toISOString()}|${e.campaignId}|${e.placement}|${city}`;
    const bucket =
      buckets.get(key) ??
      {
        day,
        campaignId: e.campaignId,
        placement: e.placement,
        citySlug: city,
        impressions: 0,
        loads: 0,
        renders: 0,
        clicks: 0,
        conversions: 0,
        invalidEvents: 0,
        costCents: 0,
      };

    // Un événement écarté ne compte dans aucune métrique de performance : il a
    // sa propre colonne. Le fondre dans les impressions gonflerait le
    // dénominateur du taux de clic et ferait passer une campagne saine pour
    // mauvaise.
    if (e.validationStatus !== "VALID") bucket.invalidEvents++;
    // `IMPRESSION` est l'ancien nom, d'avant la mesure de visibilité : les
    // lignes existantes restent lisibles.
    else if (e.type === "VIEWABLE_IMPRESSION" || e.type === "IMPRESSION") bucket.impressions++;
    else if (e.type === "LOAD") bucket.loads++;
    else if (e.type === "RENDER") bucket.renders++;
    else if (e.type === "CLICK") bucket.clicks++;
    else if (e.type === "CONVERSION") bucket.conversions++;
    bucket.costCents += e.costCents;

    buckets.set(key, bucket);
  }

  for (const b of buckets.values()) {
    await prisma.adStatDaily.upsert({
      where: {
        day_campaignId_placement_citySlug: {
          day: b.day,
          campaignId: b.campaignId,
          placement: b.placement,
          citySlug: b.citySlug,
        },
      },
      // Écrasement, pas incrément : c'est ce qui rend le roulement rejouable.
      // Écrasement des compteurs d'événements, jamais des compteurs d'enchères :
      // ceux-là sont incrémentés par le moteur au fil des sélections et ne se
      // recalculent pas depuis les événements — une enchère perdue ne laisse
      // aucune trace ailleurs.
      update: {
        impressions: b.impressions,
        loads: b.loads,
        renders: b.renders,
        clicks: b.clicks,
        conversions: b.conversions,
        invalidEvents: b.invalidEvents,
        costCents: b.costCents,
      },
      create: b,
    });
  }

  const days = new Set([...buckets.values()].map((b) => b.day.toISOString())).size;
  return { days, rows: buckets.size, events: events.length };
}

// ── Lecture ─────────────────────────────────────────────────────────────────

export type Totals = {
  /** Impressions **visibles**. C'est le seul dénominateur honnête d'un CTR. */
  impressions: number;
  /** Publicités chargées et rendues : jamais facturées, jamais confondues. */
  loads: number;
  renders: number;
  clicks: number;
  conversions: number;
  /** Événements écartés — robots, doubles clics, visibilité insuffisante. */
  invalidEvents: number;
  costCents: number;
  /** `null` sans impression : un taux de clic sur zéro affichage ne veut rien dire. */
  ctr: number | null;
  /** Coût par clic réel, `null` sans clic. */
  cpcCents: number | null;
  /** Part des publicités chargées qui atteignent réellement l'écran. */
  viewabilityRate: number | null;
  /** Coût par conversion, `null` sans conversion. */
  costPerConversionCents: number | null;
  /** Enchères disputées et gagnées, et rang moyen des enchères gagnées. */
  auctionEntries: number;
  auctionWins: number;
  winRate: number | null;
  avgAdRank: number | null;
};

export type DayPoint = {
  day: string;
  impressions: number;
  loads: number;
  clicks: number;
  costCents: number;
};
export type CityRow = { citySlug: string; impressions: number; clicks: number; costCents: number };

/**
 * Une ligne par emplacement : ce que cette bannière-là a réellement produit.
 *
 * Un total global ne dit pas quoi couper. Deux emplacements peuvent afficher
 * le même nombre d'impressions et n'avoir rien à voir : l'un ramène des clics
 * à 12 centimes, l'autre brûle le budget sans être cliqué. C'est cette
 * comparaison que l'annonceur vient chercher.
 */
export type PlacementRow = {
  placement: string;
  impressions: number;
  loads: number;
  clicks: number;
  conversions: number;
  costCents: number;
  ctr: number | null;
  cpcCents: number | null;
  /** Part des chargements devenus des impressions visibles, en pourcentage. */
  viewabilityRate: number | null;
  /** Part des enchères disputées qui ont été gagnées, en pourcentage. */
  winRate: number | null;
  /** Impressions de la période précédente, pour situer l'évolution. */
  previousImpressions: number;
};

type StatRow = {
  impressions: number;
  loads: number;
  renders: number;
  clicks: number;
  conversions: number;
  invalidEvents: number;
  costCents: number;
  auctionEntries: number;
  auctionWins: number;
  adRankSum: number;
};

function totalsFrom(rows: StatRow[]): Totals {
  const sum = (pick: (r: StatRow) => number) => rows.reduce((acc, r) => acc + pick(r), 0);

  const impressions = sum((r) => r.impressions);
  const loads = sum((r) => r.loads);
  const clicks = sum((r) => r.clicks);
  const conversions = sum((r) => r.conversions);
  const costCents = sum((r) => r.costCents);
  const auctionEntries = sum((r) => r.auctionEntries);
  const auctionWins = sum((r) => r.auctionWins);
  const adRankSum = sum((r) => r.adRankSum);

  return {
    impressions,
    loads,
    renders: sum((r) => r.renders),
    clicks,
    conversions,
    invalidEvents: sum((r) => r.invalidEvents),
    costCents,
    // Le taux de clic se calcule sur les impressions **visibles**, jamais sur
    // les publicités chargées : diviser par les chargements ferait paraître
    // mauvaise une campagne servie sur des encarts jamais atteints.
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpcCents: clicks > 0 ? Math.round(costCents / clicks) : null,
    viewabilityRate: loads > 0 ? Math.min(1, impressions / loads) * 100 : null,
    costPerConversionCents: conversions > 0 ? Math.round(costCents / conversions) : null,
    auctionEntries,
    auctionWins,
    winRate: auctionEntries > 0 ? (auctionWins / auctionEntries) * 100 : null,
    avgAdRank: auctionWins > 0 ? adRankSum / auctionWins : null,
  };
}

/**
 * Statistiques d'un annonceur sur une fenêtre de jours.
 *
 * Renvoie aussi la période précédente de même durée : afficher « 247 € » sans
 * dire si c'est mieux ou moins bien que la semaine dernière n'aide personne à
 * décider quoi que ce soit.
 */
export async function advertiserStats(advertiserId: string, days = 30) {
  const from = parisDay(new Date(Date.now() - (days - 1) * 86_400_000));
  const previousFrom = parisDay(new Date(Date.now() - (days * 2 - 1) * 86_400_000));

  // Aujourd'hui ne passe pas par les agrégats.
  //
  // Le roulement tourne à l'heure : un annonceur qui vient de voir sa bannière
  // s'afficher trouvait un tableau inchangé pendant cinquante minutes, et en
  // concluait — légitimement — que rien n'était compté. Les jours clos se
  // lisent donc dans `AdStatDaily`, la journée en cours directement dans
  // `AdEvent`. Le volume d'un seul jour reste petit, et le roulement écrasera
  // la même valeur cette nuit : les deux sources ne peuvent pas diverger.
  const today = parisDay(new Date());
  const todayStart = parisMidnightInstant();

  const [stored, liveGroups] = await Promise.all([
    prisma.adStatDaily.findMany({
      where: {
        campaign: { advertiserId },
        day: { gte: previousFrom, lt: today },
      },
      select: {
        day: true,
        citySlug: true,
        placement: true,
        impressions: true,
        loads: true,
        renders: true,
        clicks: true,
        conversions: true,
        invalidEvents: true,
        costCents: true,
        auctionEntries: true,
        auctionWins: true,
        adRankSum: true,
      },
      orderBy: { day: "asc" },
    }),
    prisma.adEvent.groupBy({
      by: ["placement", "citySlug", "type", "validationStatus"],
      where: { campaign: { advertiserId }, createdAt: { gte: todayStart } },
      _count: { _all: true },
      _sum: { costCents: true },
    }),
  ]);

  const liveByKey = new Map<string, (typeof stored)[number]>();
  for (const g of liveGroups) {
    const citySlug = g.citySlug ?? "";
    const key = `${g.placement}|${citySlug}`;
    const row =
      liveByKey.get(key) ??
      {
        day: today,
        citySlug,
        placement: g.placement,
        impressions: 0,
        loads: 0,
        renders: 0,
        clicks: 0,
        conversions: 0,
        invalidEvents: 0,
        costCents: 0,
        // Les compteurs d'enchères du jour ne sont pas relus ici : le moteur
        // les écrit directement dans l'agrégat, y compris pour aujourd'hui.
        auctionEntries: 0,
        auctionWins: 0,
        adRankSum: 0,
      };
    const count = g._count._all;
    if (g.validationStatus !== "VALID") row.invalidEvents += count;
    else if (g.type === "VIEWABLE_IMPRESSION" || g.type === "IMPRESSION") row.impressions += count;
    else if (g.type === "LOAD") row.loads += count;
    else if (g.type === "RENDER") row.renders += count;
    else if (g.type === "CLICK") row.clicks += count;
    else if (g.type === "CONVERSION") row.conversions += count;
    row.costCents += g._sum.costCents ?? 0;
    liveByKey.set(key, row);
  }

  const rows = [...stored, ...liveByKey.values()];

  const current = rows.filter((r) => r.day >= from);
  const previous = rows.filter((r) => r.day < from);

  // Série journalière, trous compris : une courbe qui saute les jours sans
  // diffusion ment sur la régularité de la campagne.
  const byDay = new Map<string, DayPoint>();
  for (let i = 0; i < days; i++) {
    const d = parisDay(new Date(from.getTime() + i * 86_400_000));
    byDay.set(d.toISOString().slice(0, 10), {
      day: d.toISOString().slice(0, 10),
      impressions: 0,
      loads: 0,
      clicks: 0,
      costCents: 0,
    });
  }
  for (const r of current) {
    const key = r.day.toISOString().slice(0, 10);
    const point = byDay.get(key);
    if (!point) continue;
    point.impressions += r.impressions;
    point.loads += r.loads;
    point.clicks += r.clicks;
    point.costCents += r.costCents;
  }

  // Ventilation par emplacement, période courante et précédente. Le même
  // accumulateur sert aux deux : la seule différence est la fenêtre de jours.
  const accPlacements = (source: typeof current) => {
    const m = new Map<
      string,
      {
        impressions: number;
        loads: number;
        clicks: number;
        conversions: number;
        costCents: number;
        auctionEntries: number;
        auctionWins: number;
      }
    >();
    for (const r of source) {
      const row =
        m.get(r.placement) ??
        {
          impressions: 0,
          loads: 0,
          clicks: 0,
          conversions: 0,
          costCents: 0,
          auctionEntries: 0,
          auctionWins: 0,
        };
      row.impressions += r.impressions;
      row.loads += r.loads;
      row.clicks += r.clicks;
      row.conversions += r.conversions;
      row.costCents += r.costCents;
      row.auctionEntries += r.auctionEntries;
      row.auctionWins += r.auctionWins;
      m.set(r.placement, row);
    }
    return m;
  };

  const currentPlacements = accPlacements(current);
  const previousPlacements = accPlacements(previous);

  const placements: PlacementRow[] = [...currentPlacements.entries()]
    .map(([placement, r]) => ({
      placement,
      impressions: r.impressions,
      loads: r.loads,
      clicks: r.clicks,
      conversions: r.conversions,
      costCents: r.costCents,
      ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : null,
      cpcCents: r.clicks > 0 ? Math.round(r.costCents / r.clicks) : null,
      viewabilityRate: r.loads > 0 ? Math.min(1, r.impressions / r.loads) * 100 : null,
      winRate: r.auctionEntries > 0 ? (r.auctionWins / r.auctionEntries) * 100 : null,
      previousImpressions: previousPlacements.get(placement)?.impressions ?? 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);

  const byCity = new Map<string, CityRow>();
  for (const r of current) {
    const key = r.citySlug || "";
    const row = byCity.get(key) ?? { citySlug: key, impressions: 0, clicks: 0, costCents: 0 };
    row.impressions += r.impressions;
    row.clicks += r.clicks;
    row.costCents += r.costCents;
    byCity.set(key, row);
  }

  return {
    totals: totalsFrom(current),
    previous: totalsFrom(previous),
    placements,
    series: [...byDay.values()],
    cities: [...byCity.values()].sort((a, b) => b.impressions - a.impressions).slice(0, 12),
  };
}

/** Variation en pourcentage, `null` quand la période précédente est vide. */
export function variation(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

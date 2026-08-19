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
      clicks: number;
      conversions: number;
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
        clicks: 0,
        conversions: 0,
        costCents: 0,
      };

    if (e.type === "IMPRESSION") bucket.impressions++;
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
      update: {
        impressions: b.impressions,
        clicks: b.clicks,
        conversions: b.conversions,
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
  impressions: number;
  clicks: number;
  conversions: number;
  costCents: number;
  /** `null` sans impression : un taux de clic sur zéro affichage ne veut rien dire. */
  ctr: number | null;
  /** Coût par clic réel, `null` sans clic. */
  cpcCents: number | null;
};

export type DayPoint = { day: string; impressions: number; clicks: number; costCents: number };
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
  clicks: number;
  conversions: number;
  costCents: number;
  ctr: number | null;
  cpcCents: number | null;
  /** Impressions de la période précédente, pour situer l'évolution. */
  previousImpressions: number;
};

function totalsFrom(rows: { impressions: number; clicks: number; conversions: number; costCents: number }[]): Totals {
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const conversions = rows.reduce((s, r) => s + r.conversions, 0);
  const costCents = rows.reduce((s, r) => s + r.costCents, 0);
  return {
    impressions,
    clicks,
    conversions,
    costCents,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpcCents: clicks > 0 ? Math.round(costCents / clicks) : null,
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
        clicks: true,
        conversions: true,
        costCents: true,
      },
      orderBy: { day: "asc" },
    }),
    prisma.adEvent.groupBy({
      by: ["placement", "citySlug", "type"],
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
        clicks: 0,
        conversions: 0,
        costCents: 0,
      };
    const count = g._count._all;
    if (g.type === "IMPRESSION") row.impressions += count;
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
      clicks: 0,
      costCents: 0,
    });
  }
  for (const r of current) {
    const key = r.day.toISOString().slice(0, 10);
    const point = byDay.get(key);
    if (!point) continue;
    point.impressions += r.impressions;
    point.clicks += r.clicks;
    point.costCents += r.costCents;
  }

  // Ventilation par emplacement, période courante et précédente. Le même
  // accumulateur sert aux deux : la seule différence est la fenêtre de jours.
  const accPlacements = (source: typeof current) => {
    const m = new Map<string, { impressions: number; clicks: number; conversions: number; costCents: number }>();
    for (const r of source) {
      const row = m.get(r.placement) ?? { impressions: 0, clicks: 0, conversions: 0, costCents: 0 };
      row.impressions += r.impressions;
      row.clicks += r.clicks;
      row.conversions += r.conversions;
      row.costCents += r.costCents;
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
      clicks: r.clicks,
      conversions: r.conversions,
      costCents: r.costCents,
      ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : null,
      cpcCents: r.clicks > 0 ? Math.round(r.costCents / r.clicks) : null,
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

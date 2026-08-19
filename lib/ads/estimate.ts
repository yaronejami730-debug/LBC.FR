/**
 * Estimation d'audience et de performance.
 *
 * Règle unique, et elle prime sur l'envie de remplir l'écran : **on n'estime
 * que ce qu'on a observé**. Tant qu'un emplacement n'a pas assez d'historique,
 * l'assistant affiche « estimation indisponible » et explique pourquoi. Une
 * fourchette inventée se retourne contre la régie à la première facture : un
 * annonceur qui a lu « 3 200 clics » et en obtient 40 ne revient pas.
 *
 * Les chiffres sortent des agrégats (`AdStatDaily`), donc de ce qui a
 * réellement été servi et facturé, jamais d'un modèle théorique.
 */
import { prisma } from "@/lib/prisma";
import { parisDay } from "./stats";
import { floorsOf, modelForObjective, pricing } from "./billing";
import type { BillingModel } from "./auction";

/** En dessous, l'échantillon ne dit rien : deux clics ne font pas un taux. */
const MIN_IMPRESSIONS = 1000;
const MIN_CLICKS = 25;
/** Fenêtre d'observation. Trente jours lissent les jours creux sans dater. */
const WINDOW_DAYS = 30;
/** Largeur de la fourchette affichée, de part et d'autre du point estimé. */
const SPREAD = 0.3;

export type EstimateRange = { low: number; high: number };

export type EstimateResult =
  | {
      available: false;
      /** Phrase affichée telle quelle à l'annonceur. */
      reason: string;
    }
  | {
      available: true;
      dailyImpressions: EstimateRange;
      dailyClicks: EstimateRange;
      /** Taux de clic observé sur ces emplacements, en pourcentage. */
      observedCtr: number;
      /** Coût par clic estimé, en centimes. */
      cpcCents: number;
      /** Part du budget qui trouvera de l'inventaire, 0 → 1. */
      inventoryFill: number;
      note: string;
    };

function spread(value: number): EstimateRange {
  return {
    low: Math.max(0, Math.round(value * (1 - SPREAD))),
    high: Math.round(value * (1 + SPREAD)),
  };
}

/**
 * Estime ce qu'un budget quotidien peut produire sur des emplacements donnés.
 *
 * `zones` sert uniquement à restreindre l'observation quand on a de quoi : une
 * campagne parisienne n'a rien à voir avec une campagne nationale. Faute
 * d'échantillon local suffisant, on retombe sur l'observation tous territoires
 * confondus — et la note le dit.
 */
export async function estimateCampaign(input: {
  placements: string[];
  citySlugs: string[];
  dailyBudgetCents: number;
}): Promise<EstimateResult> {
  const placements = input.placements.filter(Boolean);
  if (placements.length === 0 || input.dailyBudgetCents <= 0) {
    return { available: false, reason: "Choisissez un emplacement et un budget pour voir une estimation." };
  }

  const from = parisDay(new Date(Date.now() - (WINDOW_DAYS - 1) * 86_400_000));

  const local =
    input.citySlugs.length > 0
      ? await prisma.adStatDaily.aggregate({
          where: { placement: { in: placements }, citySlug: { in: input.citySlugs }, day: { gte: from } },
          _sum: { impressions: true, clicks: true, costCents: true },
        })
      : null;

  const localImpressions = local?._sum.impressions ?? 0;
  const localClicks = local?._sum.clicks ?? 0;
  const enoughLocal = localImpressions >= MIN_IMPRESSIONS && localClicks >= MIN_CLICKS;

  const scope = enoughLocal
    ? local!
    : await prisma.adStatDaily.aggregate({
        where: { placement: { in: placements }, day: { gte: from } },
        _sum: { impressions: true, clicks: true, costCents: true },
      });

  const impressions = scope._sum.impressions ?? 0;
  const clicks = scope._sum.clicks ?? 0;

  if (impressions < MIN_IMPRESSIONS || clicks < MIN_CLICKS) {
    return {
      available: false,
      reason:
        "Estimation indisponible : ces emplacements n'ont pas encore assez d'historique pour " +
        "avancer un chiffre honnête. Elle apparaîtra dès que les premières campagnes auront " +
        "produit des données.",
    };
  }

  const ctr = clicks / impressions;

  // Coût unitaire moyen des emplacements retenus, d'après la grille en vigueur.
  const grid = await pricing();
  const rows = placements.map((p) => grid.get(p)).filter(Boolean) as NonNullable<
    ReturnType<Awaited<ReturnType<typeof pricing>>["get"]>
  >[];
  if (rows.length === 0) {
    return { available: false, reason: "Ces emplacements ne sont pas encore ouverts à la vente." };
  }

  // Coût d'une impression, quel que soit le modèle : en CPC, une impression
  // ne coûte que par le clic qu'elle produit statistiquement.
  const costPerImpression =
    rows.reduce((sum, r) => sum + (r.model === "CPM" ? r.priceCents / 1000 : r.priceCents * ctr), 0) /
    rows.length;

  if (costPerImpression <= 0) {
    return { available: false, reason: "Estimation indisponible pour ces emplacements." };
  }

  const wantedImpressions = input.dailyBudgetCents / costPerImpression;

  // Plafond d'inventaire : on ne peut pas servir plus d'impressions qu'il n'y
  // en a. Sans ce garde-fou, un budget de 500 €/jour promettrait un volume que
  // le site ne produit pas.
  const dailyAvailable = impressions / WINDOW_DAYS;
  const servable = Math.min(wantedImpressions, dailyAvailable);
  const fill = wantedImpressions > 0 ? servable / wantedImpressions : 0;

  const cpcCents = ctr > 0 ? Math.round(costPerImpression / ctr) : 0;

  return {
    available: true,
    dailyImpressions: spread(servable),
    dailyClicks: spread(servable * ctr),
    observedCtr: ctr * 100,
    cpcCents,
    inventoryFill: fill,
    note: enoughLocal
      ? "Estimation fondée sur les performances observées dans les zones que vous avez choisies."
      : "Estimation fondée sur les performances observées tous territoires confondus : vos zones " +
        "n'ont pas encore assez d'historique propre.",
  };
}


// ── Contexte d'enchère ──────────────────────────────────────────────────────

export type AuctionContext = {
  model: BillingModel;
  /** Enchère minimale acceptée sur les emplacements retenus, en centimes. */
  floorCents: number;
  /**
   * Prix médian réellement payé sur ces emplacements ces trente derniers jours,
   * en centimes. `null` tant qu'il n'y a pas assez d'historique — on ne suggère
   * pas un prix qu'on n'a pas observé.
   */
  medianPriceCents: number | null;
  /** Nombre de campagnes en concurrence sur au moins un de ces emplacements. */
  competitors: number;
  /** Phrase affichée telle quelle sous le champ d'enchère. */
  note: string;
};

/**
 * Ce qu'il faut savoir avant de poser une enchère.
 *
 * Un champ « enchère maximale » sans repère est un piège : l'annonceur met
 * 1 000 € par prudence, ou 5 centimes et ne comprend pas pourquoi il n'est
 * jamais servi. On lui donne donc le plancher — un fait — et le prix médian
 * réellement payé — une observation. Jamais une promesse.
 */
export async function auctionContext(input: {
  placements: string[];
  objective: string;
}): Promise<AuctionContext> {
  const model = modelForObjective(input.objective);
  const grid = await pricing();

  const placements = input.placements.filter(Boolean);
  const floorCents = placements.length
    ? Math.max(
        ...placements.map((p) => {
          const f = floorsOf(grid.get(p));
          return model === "CPM" ? f.cpmCents : f.cpcCents;
        }),
      )
    : model === "CPM"
      ? 200
      : 15;

  const since = new Date(Date.now() - 30 * 86_400_000);

  // Prix médian : lu sur les événements réellement facturés, pas sur les
  // plafonds déclarés. Ce sont deux choses différentes, et c'est justement le
  // sujet d'une enchère au second prix.
  const [billed, competitors] = await Promise.all([
    prisma.adEvent.findMany({
      where: {
        placement: { in: placements.length ? placements : undefined },
        type: model === "CPM" ? { in: ["VIEWABLE_IMPRESSION", "IMPRESSION"] } : "CLICK",
        billingStatus: "BILLED",
        createdAt: { gte: since },
        priceCents: { gt: 0 },
      },
      select: { priceCents: true },
      take: 2000,
      orderBy: { createdAt: "desc" },
    }),
    prisma.adCampaign.count({
      where: {
        status: "ACTIVE",
        billingModel: model,
        ...(placements.length ? { placements: { some: { placement: { in: placements } } } } : {}),
      },
    }),
  ]);

  const prices = billed.map((b) => b.priceCents ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
  const medianPriceCents = prices.length >= 20 ? prices[Math.floor(prices.length / 2)] : null;

  const unit = model === "CPM" ? "pour mille impressions visibles" : "par clic";
  const note = medianPriceCents
    ? `Prix médian constaté sur ces emplacements : ${(medianPriceCents / 100).toFixed(2)} € ${unit}. Votre enchère est un plafond : vous payez le prix qu'il faut pour passer devant le suivant, jamais plus.`
    : `Pas encore assez d'historique sur ces emplacements pour afficher un prix constaté. Le minimum accepté est de ${(floorCents / 100).toFixed(2)} € ${unit}.`;

  return { model, floorCents, medianPriceCents, competitors, note };
}

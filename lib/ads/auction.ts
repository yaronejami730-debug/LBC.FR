/**
 * L'enchère.
 *
 * Chaque encart à remplir est une enchère : les campagnes éligibles s'y
 * présentent avec leur plafond et leur score qualité, une seule est servie, et
 * elle paie **le prix qu'il fallait pour gagner**, pas son plafond. C'est la
 * différence entre une régie et une grille tarifaire : l'annonceur dit jusqu'où
 * il est prêt à aller, le marché dit ce que ça coûte réellement.
 *
 * Trois décisions structurent tout le fichier :
 *
 *  - **le classement se fait en eCPM**, c'est-à-dire en revenu attendu pour
 *    mille affichages. Sans cette conversion, une campagne au clic et une
 *    campagne à la visibilité seraient comparées dans deux unités différentes,
 *    et la régie servirait systématiquement la mauvaise ;
 *  - **la qualité entre dans le rang, pas seulement dans le prix.** Un plafond
 *    de 70 centimes avec un bon créatif doit pouvoir battre un plafond d'un
 *    euro avec un mauvais, sinon l'inventaire se remplit de publicités que
 *    personne ne clique — l'annonceur paie, le visiteur subit ;
 *  - **le second prix**, enfin : le gagnant paie juste ce qu'il faut pour
 *    dépasser le suivant, plus un centime. Un annonceur n'a alors aucune raison
 *    de sous-enchérir par prudence, ce qui rend son plafond honnête et le
 *    marché lisible.
 *
 * Le module est **pur** : aucune lecture de base, aucun accès à l'horloge en
 * dehors de l'identifiant d'enchère. C'est ce qui permet de le tester
 * exhaustivement — un moteur d'enchères qu'on ne peut pas rejouer à
 * l'identique n'est pas défendable devant un annonceur qui conteste sa facture.
 */
import { randomUUID } from "node:crypto";
import { DEFAULT_BASELINE_CTR, normalizedQuality } from "./quality-score";

/** Pas minimal d'une enchère : un centime. En dessous, le prix ne se lit plus. */
export const MIN_INCREMENT_CENTS = 1;

export type BillingModel = "CPC" | "CPM";

export type AuctionCandidate = {
  campaignId: string;
  adId: string;
  /** Plafond de l'annonceur, en centimes (par clic ou pour mille impressions). */
  maxBidCents: number;
  /** Score qualité du créatif, 0–100. */
  qualityScore: number;
  billingModel: BillingModel;
  /**
   * Pertinence pour ce visiteur, 0–1, neutre à 1.
   *
   * C'est là que l'objectif et le ciblage entrent dans l'enchère : une campagne
   * dont les univers collent à l'intention du visiteur monte, sans que cela
   * dépende du montant qu'elle met.
   */
  relevance?: number;
  /** Taux de clic constaté du créatif, quand il est connu. */
  observedCtr?: number | null;
};

export type AuctionFloors = {
  /** Prix plancher de l'emplacement, en centimes. */
  cpcCents: number;
  cpmCents: number;
};

export type RankedCandidate = AuctionCandidate & {
  /** Revenu attendu pour mille affichages, en centimes. */
  adRank: number;
  /** Taux de clic retenu pour le calcul, quand la campagne est au clic. */
  predictedCtr: number;
};

export type AuctionResult = {
  auctionId: string;
  winner: RankedCandidate;
  /** Prix réellement facturable : par clic en CPC, pour mille en CPM. */
  priceCents: number;
  /** Rang du gagnant et du suivant — ce qui explique le prix. */
  adRank: number;
  runnerUpRank: number | null;
  /** Nombre de campagnes en lice, gagnant compris. */
  entries: number;
  ranked: RankedCandidate[];
};

/**
 * Taux de clic attendu d'un créatif.
 *
 * Le score qualité est ce que la régie sait de mieux tant qu'un créatif n'a pas
 * d'historique propre : à 70 — le neutre — on attend la moyenne du marché ; à
 * 100, le double ; à 25, un tiers. Dès qu'un taux de clic réel existe, il prend
 * le dessus, lissé par le score pour ne pas suivre chaque soubresaut.
 */
export function predictCtr(candidate: AuctionCandidate, baselineCtr = DEFAULT_BASELINE_CTR): number {
  const base = baselineCtr > 0 ? baselineCtr : DEFAULT_BASELINE_CTR;
  const qualityMultiplier = Math.min(2, Math.max(0.3, normalizedQuality(candidate.qualityScore) / 0.7));
  if (candidate.observedCtr && candidate.observedCtr > 0) {
    // Moyenne des deux : l'observé dit ce qui s'est passé, le score dit ce qu'on
    // en pense une fois la qualité de la destination et du trafic prise en
    // compte. Se fier au seul observé ferait remonter un créatif dont les clics
    // sont douteux.
    return (candidate.observedCtr + base * qualityMultiplier) / 2;
  }
  return base * qualityMultiplier;
}

/**
 * Rang d'une campagne, exprimé en revenu attendu pour mille affichages.
 *
 * En CPC : mille affichages produisent `pCTR × 1000` clics, chacun facturé au
 * plus le plafond. En CPM : le plafond **est** le prix de mille affichages, et
 * la qualité s'applique directement — sans quoi une campagne à la visibilité
 * échapperait au seul critère qui protège le visiteur.
 */
export function adRankOf(
  candidate: AuctionCandidate,
  bidCents: number,
  baselineCtr = DEFAULT_BASELINE_CTR,
): number {
  const relevance = clampRelevance(candidate.relevance);
  if (candidate.billingModel === "CPM") {
    return bidCents * normalizedQuality(candidate.qualityScore) * relevance;
  }
  return bidCents * predictCtr(candidate, baselineCtr) * 1000 * relevance;
}

/**
 * Enchère minimale qu'il aurait fallu pour atteindre un rang donné.
 *
 * C'est l'inverse exact de `adRankOf` : le prix du second prix se calcule en
 * demandant « quel plafond aurait suffi pour égaler le suivant ? ». Les deux
 * fonctions doivent rester en miroir — si l'une change, l'autre change, sinon
 * le prix facturé cesse de correspondre au classement affiché.
 */
export function bidNeededFor(
  candidate: AuctionCandidate,
  targetRank: number,
  baselineCtr = DEFAULT_BASELINE_CTR,
): number {
  const relevance = clampRelevance(candidate.relevance);
  if (candidate.billingModel === "CPM") {
    const denominator = normalizedQuality(candidate.qualityScore) * relevance;
    return denominator > 0 ? targetRank / denominator : Infinity;
  }
  const denominator = predictCtr(candidate, baselineCtr) * 1000 * relevance;
  return denominator > 0 ? targetRank / denominator : Infinity;
}

function clampRelevance(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 1;
  // Bornée : la pertinence module, elle ne décide pas. Une campagne parfaitement
  // ciblée mais à dix centimes ne doit pas rafler un inventaire disputé.
  return Math.min(1.5, Math.max(0.5, value));
}

/** Plancher applicable à une campagne, selon son modèle. */
export function floorFor(model: BillingModel, floors: AuctionFloors): number {
  return model === "CPM" ? floors.cpmCents : floors.cpcCents;
}

/**
 * Déroule l'enchère et renvoie le gagnant avec son prix.
 *
 * `null` quand personne n'est en lice, ou quand aucun plafond n'atteint le
 * plancher de l'emplacement : mieux vaut un encart vide qu'un inventaire bradé.
 */
export function runAuction(
  candidates: AuctionCandidate[],
  floors: AuctionFloors,
  options: { baselineCtr?: number; auctionId?: string } = {},
): AuctionResult | null {
  const baselineCtr = options.baselineCtr ?? DEFAULT_BASELINE_CTR;

  // Un plafond sous le plancher n'est pas une enchère perdante : c'est une
  // enchère qui n'a pas lieu. L'écarter ici évite qu'elle tire le second prix
  // vers le bas pour les autres.
  const eligible = candidates.filter((c) => c.maxBidCents >= floorFor(c.billingModel, floors));
  if (eligible.length === 0) return null;

  const ranked: RankedCandidate[] = eligible
    .map((c) => ({
      ...c,
      predictedCtr: predictCtr(c, baselineCtr),
      adRank: adRankOf(c, c.maxBidCents, baselineCtr),
    }))
    .sort((a, b) => b.adRank - a.adRank);

  const winner = ranked[0];
  const runnerUp = ranked[1] ?? null;
  const floor = floorFor(winner.billingModel, floors);

  // Sans concurrent, le prix est le plancher : le gagnant n'a personne à
  // dépasser, et l'inventaire a quand même une valeur minimale.
  let priceCents: number;
  if (!runnerUp) {
    priceCents = floor;
  } else {
    const needed = bidNeededFor(winner, runnerUp.adRank, baselineCtr);
    priceCents = Math.ceil(needed) + MIN_INCREMENT_CENTS;
  }

  // Garde-fous, dans cet ordre : jamais sous le plancher, jamais au-dessus du
  // plafond consenti. Le second est le plus important — c'est l'engagement pris
  // envers l'annonceur, et aucune formule ne doit pouvoir le déborder.
  priceCents = Math.max(floor, priceCents);
  priceCents = Math.min(winner.maxBidCents, priceCents);

  return {
    auctionId: options.auctionId ?? randomUUID(),
    winner,
    priceCents,
    adRank: winner.adRank,
    runnerUpRank: runnerUp?.adRank ?? null,
    entries: ranked.length,
    ranked,
  };
}

/**
 * Coût d'un événement facturable, en centimes.
 *
 * En CPC, seul le clic coûte, et il coûte le prix dégagé par l'enchère. En CPM,
 * seule l'impression visible coûte, et elle vaut un millième du prix — arrondi
 * au centime supérieur, pour ne jamais facturer zéro un affichage réellement
 * servi.
 *
 * Le prix vient toujours de l'enchère enregistrée, jamais du navigateur : c'est
 * la règle qui rend la facturation défendable.
 */
export function billableCost(
  eventType: string,
  model: BillingModel,
  priceCents: number,
): number {
  if (priceCents <= 0) return 0;
  if (model === "CPM") {
    return eventType === "VIEWABLE_IMPRESSION" || eventType === "IMPRESSION"
      ? Math.ceil(priceCents / 1000)
      : 0;
  }
  return eventType === "CLICK" ? priceCents : 0;
}

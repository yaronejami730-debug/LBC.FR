/**
 * Portefeuille prépayé de l'annonceur.
 *
 * Deal&Co vend de l'espace publicitaire : elle **est** le vendeur, l'argent
 * lui revient, et l'encaissement se fait sur son propre compte Stripe. Rien à
 * voir avec le paiement des professionnels, où la plateforme ne touche pas les
 * fonds — ce sont deux métiers, et les confondre serait une faute.
 *
 * Prépayé plutôt qu'à terme : aucun impayé possible, aucune relance à écrire,
 * et l'arrêt de diffusion devient une simple comparaison de solde.
 *
 * ## Le journal fait foi
 *
 * `Advertiser.balanceCents` existe pour être lu en une requête, mais il n'est
 * jamais la source de vérité : le solde est le cumul des mouvements, et chaque
 * mouvement fige le solde d'avant et d'après. Une divergence devient alors
 * visible au lieu d'être silencieuse.
 *
 * ## Deux enveloppes, pas une
 *
 * Le disponible n'est pas le diffusable. Un portefeuille de 1 000 € sur lequel
 * deux campagnes de 400 € tournent n'a que 200 € à engager : le reste est déjà
 * promis. D'où `reservedCents`, et deux types de mouvements — `RESERVATION` et
 * `RELEASE` — qui **ne déplacent pas d'argent** : ils déplacent une promesse.
 *
 * La règle de lecture du journal en découle, et elle est la seule à connaître :
 *
 *     solde = somme des amountCents des mouvements HORS RESERVATION et RELEASE
 *
 * Sans cette séparation, deux campagnes lancées le même jour se partageraient
 * deux fois le même argent, et la seconde s'arrêterait au milieu de la semaine
 * sans que personne comprenne pourquoi.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type MovementType =
  | "RECHARGE"
  | "SPEND"
  | "REFUND"
  | "ADJUSTMENT"
  | "RESERVATION"
  | "RELEASE"
  | "BONUS";

/** Mouvements qui déplacent une promesse, pas de l'argent. */
const ENVELOPE_ONLY: MovementType[] = ["RESERVATION", "RELEASE"];

/** TVA française sur les prestations publicitaires. */
export const VAT_RATE = 0.2;

/** Recharge minimale : en dessous, les frais Stripe mangent l'opération. */
export const MIN_TOPUP_CENTS = 2000;
export const MAX_TOPUP_CENTS = 500_000;

/** Montants proposés en un clic, en centimes hors taxes. */
export const TOPUP_PRESETS_CENTS = [5000, 10_000, 25_000, 50_000, 100_000] as const;

export type MovementResult = {
  balanceCents: number;
  reservedCents: number;
  /** Faux quand la clé d'idempotence avait déjà été utilisée : rien n'a bougé. */
  applied: boolean;
};

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/**
 * Écrit un mouvement et met les compteurs à jour, en une transaction.
 *
 * Les deux écritures ne peuvent pas diverger : un solde crédité sans ligne de
 * mouvement serait de l'argent sans origine, et une ligne sans solde serait un
 * paiement sans effet.
 *
 * `idempotencyKey` est ce qui rend l'appel rejouable : deux livraisons du même
 * webhook, deux tentatives d'un même débit, et c'est la contrainte d'unicité
 * de la base qui tranche — pas une lecture préalable, qui laisserait une
 * fenêtre entre le contrôle et l'écriture.
 */
export async function recordMovement(input: {
  advertiserId: string;
  type: MovementType;
  amountCents: number;
  label: string;
  campaignId?: string | null;
  stripeSessionId?: string | null;
  adEventId?: string | null;
  idempotencyKey?: string | null;
  /** Variation du réservé, en centimes. Positive à la réservation. */
  reservedDeltaCents?: number;
}): Promise<MovementResult> {
  const movesMoney = !ENVELOPE_ONLY.includes(input.type);
  const amount = movesMoney ? input.amountCents : 0;

  try {
    return await prisma.$transaction(async (tx) => {
      const before = await tx.advertiser.findUnique({
        where: { id: input.advertiserId },
        select: { balanceCents: true, reservedCents: true },
      });
      if (!before) throw new Error(`Annonceur introuvable : ${input.advertiserId}`);

      const reservedDelta = input.reservedDeltaCents ?? 0;
      // Le réservé ne descend jamais sous zéro : une libération plus large que
      // la réservation existante est une erreur de comptage, pas une dette.
      const nextReserved = Math.max(0, before.reservedCents + reservedDelta);

      const advertiser = await tx.advertiser.update({
        where: { id: input.advertiserId },
        data: {
          ...(amount !== 0 ? { balanceCents: { increment: amount } } : {}),
          reservedCents: nextReserved,
        },
        select: { balanceCents: true, reservedCents: true },
      });

      await tx.adWalletTransaction.create({
        data: {
          advertiserId: input.advertiserId,
          type: input.type,
          amountCents: input.amountCents,
          balanceBeforeCents: before.balanceCents,
          balanceAfterCents: advertiser.balanceCents,
          label: input.label,
          campaignId: input.campaignId ?? null,
          stripeSessionId: input.stripeSessionId ?? null,
          adEventId: input.adEventId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });

      return {
        balanceCents: advertiser.balanceCents,
        reservedCents: advertiser.reservedCents,
        applied: true,
      };
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Déjà appliqué : la clé d'idempotence a fait son travail. On renvoie
      // l'état courant plutôt qu'une erreur — l'appelant demandait un effet,
      // l'effet est là.
      const current = await prisma.advertiser.findUnique({
        where: { id: input.advertiserId },
        select: { balanceCents: true, reservedCents: true },
      });
      return {
        balanceCents: current?.balanceCents ?? 0,
        reservedCents: current?.reservedCents ?? 0,
        applied: false,
      };
    }
    throw e;
  }
}

// ── Lecture ─────────────────────────────────────────────────────────────────

export type WalletState = {
  balanceCents: number;
  reservedCents: number;
  /** Ce qui peut encore être engagé sur une nouvelle campagne. */
  availableCents: number;
  billingDisabled: boolean;
};

export async function walletState(advertiserId: string): Promise<WalletState | null> {
  const a = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: { balanceCents: true, reservedCents: true, billingDisabledAt: true },
  });
  if (!a) return null;
  return {
    balanceCents: a.balanceCents,
    reservedCents: a.reservedCents,
    availableCents: Math.max(0, a.balanceCents - a.reservedCents),
    billingDisabled: Boolean(a.billingDisabledAt),
  };
}

/** L'annonceur a-t-il de quoi diffuser ? */
export async function hasFunds(advertiserId: string): Promise<boolean> {
  const state = await walletState(advertiserId);
  if (!state) return false;
  return state.billingDisabled || state.balanceCents > 0;
}

/**
 * Recalcule le solde depuis le journal.
 *
 * Sert au contrôle, pas au fonctionnement courant : si ce total et
 * `balanceCents` divergent, c'est le journal qui a raison, et il faut
 * comprendre pourquoi avant de corriger quoi que ce soit.
 */
export async function ledgerBalance(advertiserId: string): Promise<number> {
  const agg = await prisma.adWalletTransaction.aggregate({
    where: { advertiserId, type: { notIn: ENVELOPE_ONLY } },
    _sum: { amountCents: true },
  });
  return agg._sum.amountCents ?? 0;
}

// ── Engagement d'une campagne ───────────────────────────────────────────────

export class WalletError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WalletError";
  }
}

/**
 * Engagement courant d'une campagne, lu au journal.
 *
 * Une campagne peut être engagée, arrêtée, relancée, débitée : son engagement
 * est le solde de ces mouvements, pas la dernière valeur écrite quelque part.
 * Le calculer plutôt que le stocker évite la seule chose qu'on ne saurait pas
 * réparer — un compteur d'engagement qui a divergé sans qu'on sache quand.
 */
export async function campaignReservation(campaignId: string): Promise<number> {
  const rows = await prisma.adWalletTransaction.groupBy({
    by: ["type"],
    where: { campaignId, type: { in: ["RESERVATION", "RELEASE", "SPEND"] } },
    _sum: { amountCents: true },
  });

  let engaged = 0;
  for (const row of rows) {
    const sum = row._sum.amountCents ?? 0;
    // `RESERVATION` engage, `RELEASE` désengage, `SPEND` consomme — et
    // `SPEND` est négatif au journal, d'où la valeur absolue.
    if (row.type === "RESERVATION") engaged += sum;
    else if (row.type === "RELEASE") engaged -= sum;
    else if (row.type === "SPEND") engaged -= Math.abs(sum);
  }
  return Math.max(0, engaged);
}

/**
 * Porte l'engagement d'une campagne au montant voulu.
 *
 * **Cible, pas incrément.** Demander « engage 300 € pour cette campagne » deux
 * fois de suite doit laisser 300 € engagés, pas 600 : une campagne validée puis
 * relancée passerait sinon pour deux campagnes, et le portefeuille se
 * bloquerait tout seul.
 *
 * Corollaire, et c'est ce qui a motivé cette forme : l'idempotence ne peut pas
 * reposer sur une clé fixe par campagne. Une campagne arrêtée libère son
 * engagement ; sa reprise doit pouvoir le reprendre. La clé porte donc l'état
 * de départ — deux appels concurrents partant du même état ne peuvent pas
 * aboutir tous les deux, mais une reprise plus tard le peut.
 *
 * Appelée au lancement, jamais à la création : un brouillon n'immobilise rien.
 */
export async function reserveCampaignBudget(input: {
  advertiserId: string;
  campaignId: string;
  amountCents: number;
  label: string;
}): Promise<MovementResult> {
  const state = await walletState(input.advertiserId);
  if (!state) throw new WalletError("Annonceur introuvable.", 404);

  const noop: MovementResult = {
    balanceCents: state.balanceCents,
    reservedCents: state.reservedCents,
    applied: false,
  };

  // Gratuité déclarée : rien à engager, puisque rien ne sera débité.
  if (state.billingDisabled || input.amountCents <= 0) return noop;

  const engaged = await campaignReservation(input.campaignId);
  const delta = input.amountCents - engaged;
  if (delta <= 0) return noop;

  if (state.availableCents < delta) {
    throw new WalletError(
      `Portefeuille insuffisant : ${(state.availableCents / 100).toFixed(2)} € disponibles pour un budget de ${(delta / 100).toFixed(2)} €.`,
      409,
    );
  }

  return recordMovement({
    advertiserId: input.advertiserId,
    type: "RESERVATION",
    amountCents: delta,
    label: input.label,
    campaignId: input.campaignId,
    idempotencyKey: `reserve:${input.campaignId}:${engaged}`,
    reservedDeltaCents: delta,
  });
}

/**
 * Libère ce qui restait engagé sur une campagne.
 *
 * Appelée à l'arrêt, à la fin, au refus. Le montant est **plafonné à
 * l'engagement réel** : libérer plus que ce qui était engagé prendrait sur les
 * autres campagnes, qui verraient leur budget se désengager sans raison.
 */
export async function releaseCampaignBudget(input: {
  advertiserId: string;
  campaignId: string;
  amountCents: number;
  label: string;
}): Promise<MovementResult | null> {
  if (input.amountCents <= 0) return null;

  const engaged = await campaignReservation(input.campaignId);
  const amount = Math.min(input.amountCents, engaged);
  if (amount <= 0) return null;

  return recordMovement({
    advertiserId: input.advertiserId,
    type: "RELEASE",
    amountCents: amount,
    label: input.label,
    campaignId: input.campaignId,
    idempotencyKey: `release:${input.campaignId}:${engaged}`,
    reservedDeltaCents: -amount,
  });
}

/**
 * Débite le portefeuille pour un événement facturable.
 *
 * La clé d'idempotence est l'identifiant de l'événement : **un événement, un
 * débit**, même si la route est rejouée ou si deux instances traitent la même
 * requête. C'est ce qui rend chaque euro dépensé traçable jusqu'au clic qui
 * l'a produit.
 *
 * Le débit réduit aussi l'engagement de la campagne : la somme dépensée n'est
 * plus une promesse, elle est partie.
 *
 * Un solde qui passe sous zéro n'est pas bloqué ici : l'événement a déjà eu
 * lieu, le refuser reviendrait à offrir la prestation. C'est la sélection qui
 * empêche de servir un annonceur à sec.
 */
export async function debitForSpend(input: {
  advertiserId: string;
  campaignId: string;
  adEventId: string;
  costCents: number;
  label: string;
}): Promise<MovementResult | null> {
  if (input.costCents <= 0) return null;
  return recordMovement({
    advertiserId: input.advertiserId,
    type: "SPEND",
    amountCents: -input.costCents,
    label: input.label,
    campaignId: input.campaignId,
    adEventId: input.adEventId,
    idempotencyKey: `spend:${input.adEventId}`,
    reservedDeltaCents: -input.costCents,
  });
}

/**
 * Rembourse un événement facturé à tort.
 *
 * Un événement reconnu frauduleux après coup — une campagne de clics découverte
 * le lendemain — doit pouvoir être rendu. Le mouvement inverse laisse les deux
 * lignes dans le journal : ce qui a été facturé, et ce qui a été rendu. Effacer
 * la première rendrait la facture incompréhensible.
 */
export async function refundEvent(input: {
  advertiserId: string;
  campaignId: string;
  adEventId: string;
  costCents: number;
  label: string;
}): Promise<MovementResult | null> {
  if (input.costCents <= 0) return null;
  return recordMovement({
    advertiserId: input.advertiserId,
    type: "REFUND",
    amountCents: input.costCents,
    label: input.label,
    campaignId: input.campaignId,
    adEventId: input.adEventId,
    idempotencyKey: `refund:${input.adEventId}`,
  });
}

/**
 * Crédite une recharge payée et émet sa facture.
 *
 * Idempotent par la référence Stripe : le webhook peut être rejoué, la même
 * session ne crédite qu'une fois. C'est la contrainte d'unicité qui tranche,
 * pas une lecture préalable — deux livraisons simultanées ne peuvent pas
 * passer toutes les deux.
 */
export async function creditTopUp(input: {
  advertiserId: string;
  amountCentsTTC: number;
  stripeSessionId: string;
}): Promise<{ credited: boolean; balanceCents?: number }> {
  // Le montant payé est TTC ; ce qui alimente le portefeuille est le HT, car
  // c'est en HT que la publicité se facture.
  const amountHT = Math.round(input.amountCentsTTC / (1 + VAT_RATE));
  const vat = input.amountCentsTTC - amountHT;

  const result = await recordMovement({
    advertiserId: input.advertiserId,
    type: "RECHARGE",
    amountCents: amountHT,
    label: `Recharge de ${(input.amountCentsTTC / 100).toFixed(2)} € TTC`,
    stripeSessionId: input.stripeSessionId,
    idempotencyKey: `stripe:${input.stripeSessionId}`,
  });

  if (!result.applied) return { credited: false };

  try {
    await prisma.adInvoice.create({
      data: {
        advertiserId: input.advertiserId,
        number: await nextInvoiceNumber(),
        amountCentsHT: amountHT,
        vatCents: vat,
        amountCentsTTC: input.amountCentsTTC,
        vatRate: VAT_RATE,
        stripeSessionId: input.stripeSessionId,
      },
    });
  } catch (e) {
    // La facture est un document, pas une condition du crédit : un doublon de
    // numérotation ne doit pas annuler une recharge déjà payée.
    if (!isUniqueViolation(e)) throw e;
  }

  return { credited: true, balanceCents: result.balanceCents };
}

/**
 * Numéro de facture séquentiel et lisible.
 *
 * Séquence par année : « DCA-2026-0007 ». Une numérotation continue est une
 * obligation comptable, et le préfixe évite de la confondre avec les autres
 * documents de Deal&Co.
 */
async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.adInvoice.count({
    where: { number: { startsWith: `DCA-${year}-` } },
  });
  return `DCA-${year}-${String(count + 1).padStart(4, "0")}`;
}

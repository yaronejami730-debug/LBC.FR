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
 * Le solde vit sur `Advertiser.balanceCents` pour être lu en une requête, mais
 * il n'est jamais la source de vérité : c'est le cumul des mouvements, et
 * chaque mouvement fige le solde qu'il produit.
 */
import { prisma } from "@/lib/prisma";

export type MovementType = "RECHARGE" | "SPEND" | "REFUND" | "ADJUSTMENT";

/** TVA française sur les prestations publicitaires. */
export const VAT_RATE = 0.2;

/** Recharge minimale : en dessous, les frais Stripe mangent l'opération. */
export const MIN_TOPUP_CENTS = 2000;
export const MAX_TOPUP_CENTS = 500_000;

/**
 * Écrit un mouvement et met le solde à jour, en une transaction.
 *
 * Les deux écritures ne peuvent pas diverger : un solde crédité sans ligne de
 * mouvement serait de l'argent sans origine, et une ligne sans solde serait un
 * paiement sans effet.
 */
export async function recordMovement(input: {
  advertiserId: string;
  type: MovementType;
  amountCents: number;
  label: string;
  campaignId?: string | null;
  stripeSessionId?: string | null;
}): Promise<{ balanceCents: number }> {
  return prisma.$transaction(async (tx) => {
    const advertiser = await tx.advertiser.update({
      where: { id: input.advertiserId },
      data: { balanceCents: { increment: input.amountCents } },
      select: { balanceCents: true },
    });

    await tx.adWalletTransaction.create({
      data: {
        advertiserId: input.advertiserId,
        type: input.type,
        amountCents: input.amountCents,
        balanceAfterCents: advertiser.balanceCents,
        label: input.label,
        campaignId: input.campaignId ?? null,
        stripeSessionId: input.stripeSessionId ?? null,
      },
    });

    return { balanceCents: advertiser.balanceCents };
  });
}

/**
 * Débite le portefeuille pour une dépense publicitaire.
 *
 * Appelé après l'imputation à la campagne : les deux compteurs disent la même
 * chose vu de deux endroits — ce que cette campagne a coûté, et ce qu'il reste
 * à l'annonceur.
 *
 * Un solde qui passe sous zéro n'est pas bloqué ici : l'événement a déjà eu
 * lieu, le refuser reviendrait à offrir la prestation. C'est la sélection qui
 * empêche de servir un annonceur à sec.
 */
export async function debitForSpend(input: {
  advertiserId: string;
  campaignId: string;
  costCents: number;
  label: string;
}): Promise<void> {
  if (input.costCents <= 0) return;
  await recordMovement({
    advertiserId: input.advertiserId,
    type: "SPEND",
    amountCents: -input.costCents,
    label: input.label,
    campaignId: input.campaignId,
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
  const existing = await prisma.adWalletTransaction.findUnique({
    where: { stripeSessionId: input.stripeSessionId },
    select: { id: true },
  });
  if (existing) return { credited: false };

  // Le montant payé est TTC ; ce qui alimente le portefeuille est le HT, car
  // c'est en HT que la publicité se facture.
  const amountHT = Math.round(input.amountCentsTTC / (1 + VAT_RATE));
  const vat = input.amountCentsTTC - amountHT;

  try {
    const { balanceCents } = await recordMovement({
      advertiserId: input.advertiserId,
      type: "RECHARGE",
      amountCents: amountHT,
      label: `Recharge de ${(input.amountCentsTTC / 100).toFixed(2)} € TTC`,
      stripeSessionId: input.stripeSessionId,
    });

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

    return { credited: true, balanceCents };
  } catch {
    // Course entre deux livraisons du même événement : la seconde tombe sur
    // la contrainte d'unicité, et c'est exactement ce qu'on veut.
    return { credited: false };
  }
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

/** L'annonceur a-t-il de quoi diffuser ? */
export async function hasFunds(advertiserId: string): Promise<boolean> {
  const a = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: { balanceCents: true },
  });
  return (a?.balanceCents ?? 0) > 0;
}

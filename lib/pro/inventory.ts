/**
 * Mouvements de stock, et effet du stock sur les annonces.
 *
 * Une règle gouverne tout le fichier : **le stock ne se pose pas, il se
 * déplace.** Écrire `quantity = 12` perd l'information de ce qui s'est passé,
 * et deux écritures concurrentes se marchent dessus sans que personne ne le
 * voie. Chaque changement passe donc par un mouvement signé, appliqué dans une
 * transaction, et la quantité portée par le produit n'est qu'un cumul de
 * lecture rapide.
 *
 * Conséquence directe : « il manque trois pièces » a toujours une réponse.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Motifs de mouvement. Le vocabulaire du magasin, pas celui du programmeur. */
export const MOVEMENT_REASONS = [
  /** Réception de marchandise. */
  "RECEIPT",
  /** Vente. */
  "SALE",
  /** Recomptage : l'inventaire réel ne correspondait pas. */
  "CORRECTION",
  /** Retour client. */
  "RETURN",
  /** Casse, vol, péremption. */
  "LOSS",
  /** Engagement d'une unité sans sortie — commande en cours. */
  "RESERVATION",
  /** Libération d'un engagement. */
  "RELEASE",
] as const;

export type MovementReason = (typeof MOVEMENT_REASONS)[number];

export function isMovementReason(value: string): value is MovementReason {
  return (MOVEMENT_REASONS as readonly string[]).includes(value);
}

export class InventoryError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "InventoryError";
  }
}

export type StockSnapshot = {
  /** Quantité physiquement présente. `null` si illimité. */
  onHand: number | null;
  /** Unités engagées mais pas encore sorties. */
  reserved: number;
  /** Ce qu'on peut réellement vendre : `onHand - reserved`. */
  available: number | null;
  unlimited: boolean;
  /** Sous le seuil d'alerte, sans être épuisé. */
  low: boolean;
  /** Plus rien à vendre. */
  outOfStock: boolean;
};

/**
 * Lecture de l'état d'un produit.
 *
 * `available` est ce qui compte pour l'acheteur : douze pièces dont onze
 * réservées, ce n'est pas douze disponibles.
 */
export function stockOf(product: {
  quantity: number | null;
  reserved: number;
  unlimited: boolean;
  lowStockAt: number | null;
  variants?: { quantity: number; reserved: number; isActive: boolean }[];
}): StockSnapshot {
  if (product.unlimited) {
    return { onHand: null, reserved: 0, available: null, unlimited: true, low: false, outOfStock: false };
  }

  // Un produit qui se décline ne porte pas de quantité propre : la somme de ses
  // variantes actives fait foi. Tenir les deux garantirait de les voir diverger.
  const variants = (product.variants ?? []).filter((v) => v.isActive);
  const onHand = variants.length
    ? variants.reduce((sum, v) => sum + v.quantity, 0)
    : (product.quantity ?? 0);
  const reserved = variants.length
    ? variants.reduce((sum, v) => sum + v.reserved, 0)
    : product.reserved;

  const available = Math.max(0, onHand - reserved);
  const threshold = product.lowStockAt;

  return {
    onHand,
    reserved,
    available,
    unlimited: false,
    low: threshold !== null && available > 0 && available <= threshold,
    outOfStock: available <= 0,
  };
}

export type MoveInput = {
  productId: string;
  variantId?: string | null;
  /** Signé : positif pour une entrée, négatif pour une sortie. */
  delta: number;
  reason: MovementReason;
  note?: string | null;
  actorId?: string | null;
  /**
   * Autorise le stock à passer sous zéro. Faux par défaut : un stock négatif
   * est presque toujours une erreur de saisie, et le laisser passer la rend
   * invisible. Le recomptage (`CORRECTION`) est le seul cas légitime.
   */
  allowNegative?: boolean;
};

/**
 * Applique un mouvement et met à jour le cumul, en une seule transaction.
 *
 * Le verrou d'écriture est pris par `update` sur la ligne concernée : deux
 * ventes simultanées de la dernière pièce ne peuvent pas réussir toutes les
 * deux. Sans transaction, elles le pourraient — et le magasin devrait un article
 * qu'il n'a plus.
 */
export async function moveStock(input: MoveInput): Promise<StockSnapshot> {
  const { productId, variantId, delta, reason, note, actorId } = input;

  if (!Number.isInteger(delta) || delta === 0) {
    throw new InventoryError("Le mouvement doit être un entier non nul.", 400);
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.proProduct.findUnique({
      where: { id: productId },
      select: { id: true, quantity: true, reserved: true, unlimited: true, lowStockAt: true },
    });
    if (!product) throw new InventoryError("Produit introuvable.", 404);
    if (product.unlimited) {
      throw new InventoryError("Ce produit est en quantité illimitée : rien à décompter.", 409);
    }

    let resulting: number;

    if (variantId) {
      const variant = await tx.proProductVariant.findUnique({
        where: { id: variantId },
        select: { id: true, productId: true, quantity: true },
      });
      if (!variant || variant.productId !== productId) {
        throw new InventoryError("Variante introuvable pour ce produit.", 404);
      }

      resulting = variant.quantity + delta;
      if (resulting < 0 && !input.allowNegative) {
        throw new InventoryError(
          `Stock insuffisant : ${variant.quantity} en magasin, ${Math.abs(delta)} demandé(s).`,
          409,
        );
      }

      await tx.proProductVariant.update({
        where: { id: variantId },
        data: { quantity: resulting },
      });
    } else {
      const current = product.quantity ?? 0;
      resulting = current + delta;
      if (resulting < 0 && !input.allowNegative) {
        throw new InventoryError(
          `Stock insuffisant : ${current} en magasin, ${Math.abs(delta)} demandé(s).`,
          409,
        );
      }

      await tx.proProduct.update({
        where: { id: productId },
        data: { quantity: resulting },
      });
    }

    await tx.proStockMovement.create({
      data: {
        productId,
        variantId: variantId ?? null,
        delta,
        resulting,
        reason,
        note: note ?? null,
        actorId: actorId ?? null,
      },
    });

    const fresh = await tx.proProduct.findUniqueOrThrow({
      where: { id: productId },
      select: {
        quantity: true,
        reserved: true,
        unlimited: true,
        lowStockAt: true,
        variants: { select: { quantity: true, reserved: true, isActive: true } },
      },
    });

    return stockOf(fresh);
  });
}

/**
 * Aligne les annonces d'un produit sur son stock.
 *
 * Deux prudences, et elles ont la même origine : ce code s'exécute sans
 * personne devant l'écran, et une annonce est un actif — vues, messages,
 * référencement.
 *
 * On ne touche donc qu'aux statuts qu'on a soi-même posés. Une annonce que la
 * modération a retirée (`REMOVED`) ou mise en revue (`UNDER_REVIEW`) n'est pas
 * remise en ligne parce qu'un carton est arrivé : ce serait contourner une
 * décision humaine. Et une annonce épuisée puis réapprovisionnée repasse en
 * ligne, parce que le professionnel n'a rien à ressaisir pour ça.
 *
 * `SOLD` est réutilisé plutôt qu'inventé : le statut existe déjà, il est déjà
 * filtré partout dans les requêtes publiques, et il dit exactement la bonne
 * chose à l'acheteur.
 */
export async function syncListingsWithStock(productId: string): Promise<{
  updated: number;
  status: "SOLD" | "APPROVED" | null;
}> {
  const product = await prisma.proProduct.findUnique({
    where: { id: productId },
    select: {
      status: true,
      quantity: true,
      reserved: true,
      unlimited: true,
      lowStockAt: true,
      variants: { select: { quantity: true, reserved: true, isActive: true } },
    },
  });
  if (!product) return { updated: 0, status: null };

  const stock = stockOf(product);
  const archived = product.status === "ARCHIVED";
  const target: "SOLD" | "APPROVED" = stock.outOfStock || archived ? "SOLD" : "APPROVED";

  const { count } = await prisma.listing.updateMany({
    where: {
      productId,
      deletedAt: null,
      // Seuls les deux statuts que ce mécanisme pilote. Tout le reste appartient
      // à la modération ou au vendeur.
      status: target === "SOLD" ? "APPROVED" : "SOLD",
    },
    data: { status: target },
  });

  return { updated: count, status: target };
}

/**
 * Vente d'unités : sortie de stock puis mise à jour des annonces.
 *
 * Les deux étapes sont volontairement séquentielles et non transactionnelles
 * entre elles. Si la synchronisation échoue, la vente reste enregistrée — un
 * stock juste avec une annonce en retard se rattrape, l'inverse non.
 */
export async function sellUnits(input: {
  productId: string;
  variantId?: string | null;
  quantity: number;
  actorId?: string | null;
  note?: string | null;
}): Promise<StockSnapshot> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new InventoryError("La quantité vendue doit être un entier positif.", 400);
  }

  const snapshot = await moveStock({
    productId: input.productId,
    variantId: input.variantId,
    delta: -input.quantity,
    reason: "SALE",
    note: input.note,
    actorId: input.actorId,
  });

  await syncListingsWithStock(input.productId).catch((err) =>
    console.error("[inventory] synchronisation des annonces", input.productId, err),
  );

  return snapshot;
}

/** Produits sous leur seuil d'alerte, pour l'écran de stock. */
export async function lowStockProducts(profileId: string) {
  const products = await prisma.proProduct.findMany({
    where: { profileId, status: "ACTIVE", unlimited: false, lowStockAt: { not: null } },
    select: {
      id: true,
      name: true,
      sku: true,
      quantity: true,
      reserved: true,
      unlimited: true,
      lowStockAt: true,
      variants: { select: { quantity: true, reserved: true, isActive: true } },
    },
    orderBy: { position: "asc" },
  });

  return products
    .map((p) => ({ ...p, stock: stockOf(p) }))
    .filter((p) => p.stock.low || p.stock.outOfStock);
}

export type { Prisma };

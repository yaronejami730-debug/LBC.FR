/**
 * Un produit : modification, mouvements de stock, archivage.
 *
 * Le `PATCH` sépare franchement deux gestes que l'interface confond souvent :
 * corriger une fiche (nom, prix, seuil) et faire bouger le stock. Le second
 * passe obligatoirement par `moveStock`, jamais par une écriture directe sur
 * `quantity` — sans quoi l'historique mentirait, et deux ventes simultanées de
 * la dernière pièce réussiraient toutes les deux.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability, ProAccessError } from "@/lib/pro/access";
import {
  moveStock,
  stockOf,
  syncListingsWithStock,
  isMovementReason,
  InventoryError,
} from "@/lib/pro/inventory";

export const runtime = "nodejs";

function fail(err: unknown) {
  if (err instanceof ProAccessError || err instanceof InventoryError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[pro/products/:id]", err);
  return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
}

/** Le produit appartient-il bien à l'établissement actif ? */
async function ownedProduct(productId: string, profileId: string) {
  const product = await prisma.proProduct.findUnique({
    where: { id: productId },
    select: { id: true, profileId: true },
  });
  // Même réponse pour « inexistant » et « appartient à quelqu'un d'autre » :
  // distinguer les deux confirmerait l'existence d'un produit concurrent.
  if (!product || product.profileId !== profileId) {
    throw new ProAccessError("Produit introuvable.", 404, "NOT_FOUND");
  }
  return product;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireCapability(req, "inventory");
    await ownedProduct(id, context.establishment.id);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // ── Mouvement de stock ────────────────────────────────────────────────
    if (body.movement && typeof body.movement === "object") {
      const m = body.movement as Record<string, unknown>;
      const delta = Number(m.delta);
      const reason = String(m.reason ?? "CORRECTION");

      if (!isMovementReason(reason)) {
        return NextResponse.json({ error: "Motif de mouvement inconnu." }, { status: 400 });
      }

      const stock = await moveStock({
        productId: id,
        variantId: m.variantId ? String(m.variantId) : null,
        delta,
        reason,
        note: m.note ? String(m.note).slice(0, 200) : null,
        actorId: context.userId,
        // Le recomptage est le seul cas où un solde négatif est un fait et non
        // une faute de saisie.
        allowNegative: reason === "CORRECTION",
      });

      const sync = await syncListingsWithStock(id).catch((err) => {
        console.error("[pro/products] synchronisation des annonces", id, err);
        return { updated: 0, status: null };
      });

      return NextResponse.json({ stock, listings: sync });
    }

    // ── Modification de la fiche ──────────────────────────────────────────
    const data: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim().length >= 2) {
      data.name = body.name.trim().slice(0, 160);
    }
    if (typeof body.description === "string") {
      data.description = body.description.trim().slice(0, 2000) || null;
    }
    if (typeof body.section === "string") {
      data.section = body.section.trim().slice(0, 80) || null;
    }
    if (Number.isFinite(Number(body.price)) && Number(body.price) >= 0) {
      data.price = Number(body.price);
    }
    if (body.comparePrice === null || Number.isFinite(Number(body.comparePrice))) {
      const v = Number(body.comparePrice);
      data.comparePrice = body.comparePrice === null || v <= 0 ? null : v;
    }
    if (body.lowStockAt === null || Number.isFinite(Number(body.lowStockAt))) {
      const v = Number(body.lowStockAt);
      data.lowStockAt = body.lowStockAt === null || v < 0 ? null : Math.trunc(v);
    }
    if (typeof body.unlimited === "boolean") data.unlimited = body.unlimited;
    if (typeof body.images === "string") data.images = body.images;
    if (body.status === "ACTIVE" || body.status === "ARCHIVED") data.status = body.status;

    if (typeof body.sku === "string") {
      const sku = body.sku.trim() || null;
      if (sku) {
        const clash = await prisma.proProduct.findFirst({
          where: { profileId: context.establishment.id, sku, NOT: { id } },
          select: { id: true },
        });
        if (clash) {
          return NextResponse.json(
            { error: `La référence « ${sku} » est déjà utilisée.` },
            { status: 409 },
          );
        }
      }
      data.sku = sku;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Rien à modifier." }, { status: 400 });
    }

    const product = await prisma.proProduct.update({
      where: { id },
      data,
      select: {
        id: true, name: true, sku: true, price: true, quantity: true, reserved: true,
        unlimited: true, lowStockAt: true, status: true,
        variants: { select: { quantity: true, reserved: true, isActive: true } },
      },
    });

    // Archiver un produit doit retirer ses annonces de la vente : elles
    // renverraient sinon vers quelque chose qui n'existe plus au magasin.
    if (data.status || typeof data.unlimited === "boolean") {
      await syncListingsWithStock(id).catch(() => {});
    }

    return NextResponse.json({ product: { ...product, stock: stockOf(product) } });
  } catch (err) {
    return fail(err);
  }
}

/**
 * Archivage. Jamais de suppression : les mouvements de stock et les annonces
 * passées font référence à ce produit, et un historique troué ne se répare pas.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireCapability(req, "inventory");
    await ownedProduct(id, context.establishment.id);

    await prisma.proProduct.update({ where: { id }, data: { status: "ARCHIVED" } });
    const sync = await syncListingsWithStock(id).catch(() => ({ updated: 0, status: null }));

    return NextResponse.json({ ok: true, archived: true, listings: sync });
  } catch (err) {
    return fail(err);
  }
}

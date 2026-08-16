/**
 * Catalogue produits d'un établissement.
 *
 * Réservé à la capacité `inventory` : `requireCapability` refuse en 403 un
 * garage qui devinerait l'URL sans avoir activé le stock. La condition métier
 * n'existe qu'à cet endroit, jamais recopiée dans les composants.
 *
 * La création pose la quantité initiale par un mouvement de stock plutôt que
 * par une écriture directe : l'historique doit expliquer le stock depuis la
 * première unité, pas depuis la deuxième.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability, ProAccessError } from "@/lib/pro/access";
import { stockOf } from "@/lib/pro/inventory";

export const runtime = "nodejs";

function fail(err: unknown) {
  if (err instanceof ProAccessError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error("[pro/products]", err);
  return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
}

const PRODUCT_SELECT = {
  id: true,
  name: true,
  sku: true,
  description: true,
  section: true,
  price: true,
  comparePrice: true,
  quantity: true,
  unlimited: true,
  lowStockAt: true,
  reserved: true,
  images: true,
  status: true,
  position: true,
  updatedAt: true,
  variants: {
    select: { id: true, label: true, sku: true, priceDelta: true, quantity: true, reserved: true, isActive: true, position: true },
    orderBy: { position: "asc" },
  },
  listings: {
    where: { deletedAt: null },
    select: { id: true, title: true, status: true },
  },
} as const;

export async function GET(req: NextRequest) {
  try {
    const context = await requireCapability(req, "inventory");

    const products = await prisma.proProduct.findMany({
      where: { profileId: context.establishment.id },
      select: PRODUCT_SELECT,
      orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "desc" }],
      take: 500,
    });

    // L'état du stock est calculé, jamais stocké : une colonne « disponible »
    // dupliquerait une soustraction et finirait par diverger.
    return NextResponse.json({
      products: products.map((p) => ({ ...p, stock: stockOf(p) })),
    });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireCapability(req, "inventory");
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const name = String(body.name ?? "").trim();
    if (name.length < 2) {
      return NextResponse.json({ error: "Le nom du produit est requis." }, { status: 400 });
    }

    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Prix invalide." }, { status: 400 });
    }

    const unlimited = body.unlimited === true;
    const rawQuantity = Number(body.quantity ?? 0);
    const quantity = unlimited ? null : Math.max(0, Math.trunc(Number.isFinite(rawQuantity) ? rawQuantity : 0));

    const sku = String(body.sku ?? "").trim() || null;
    if (sku) {
      // Contrainte d'unicité par établissement : on renvoie un message clair
      // plutôt que de laisser remonter une erreur Prisma illisible.
      const clash = await prisma.proProduct.findFirst({
        where: { profileId: context.establishment.id, sku },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json(
          { error: `La référence « ${sku} » est déjà utilisée.` },
          { status: 409 },
        );
      }
    }

    const last = await prisma.proProduct.findFirst({
      where: { profileId: context.establishment.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const product = await prisma.proProduct.create({
      data: {
        profileId: context.establishment.id,
        name: name.slice(0, 160),
        sku,
        description: String(body.description ?? "").trim().slice(0, 2000) || null,
        section: String(body.section ?? "").trim().slice(0, 80) || null,
        price,
        comparePrice: Number.isFinite(Number(body.comparePrice)) && Number(body.comparePrice) > 0
          ? Number(body.comparePrice)
          : null,
        quantity,
        unlimited,
        lowStockAt: Number.isFinite(Number(body.lowStockAt)) && Number(body.lowStockAt) >= 0
          ? Math.trunc(Number(body.lowStockAt))
          : null,
        images: typeof body.images === "string" ? body.images : "[]",
        position: (last?.position ?? 0) + 1,
      },
      select: PRODUCT_SELECT,
    });

    // Stock d'ouverture : consigné comme réception, pour que l'historique parte
    // de zéro et non d'un solde tombé du ciel.
    if (!unlimited && quantity && quantity > 0) {
      await prisma.proStockMovement.create({
        data: {
          productId: product.id,
          delta: quantity,
          resulting: quantity,
          reason: "RECEIPT",
          note: "Stock initial",
          actorId: context.userId,
        },
      });
    }

    return NextResponse.json({ product: { ...product, stock: stockOf(product) } }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}

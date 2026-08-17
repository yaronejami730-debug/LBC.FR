import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setSmartSuggestions } from "@/lib/ads/settings";
import { invalidateAdCache } from "@/lib/ads/engine";
import { invalidatePricingCache } from "@/lib/ads/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Contrôle d'accès admin, même forme que les autres routes `/api/admin/*`. */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = (session.user as { role?: string }).role;
  if (role === "ADMIN") return session.user.id;
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return dbUser?.role === "ADMIN" ? session.user.id : null;
}

/**
 * Réglages de diffusion : l'interrupteur de la suggestion et l'ouverture des
 * emplacements.
 *
 * Deux décisions d'exploitation, pas de code : allumer la diffusion suggérée
 * quand la régie a assez d'annonceurs pour que classer ait un sens, et fermer
 * un emplacement qu'on ne veut plus vendre.
 */
export async function POST(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (typeof body.smartSuggestions === "boolean") {
    await setSmartSuggestions(body.smartSuggestions, adminId);
  }

  if (typeof body.placement === "string" && typeof body.isOpen === "boolean") {
    await prisma.adPlacementPricing.update({
      where: { placement: body.placement },
      data: { isOpen: body.isOpen, updatedBy: adminId },
    });
    // Sans purge, l'emplacement continuerait d'être servi une minute durant —
    // le temps que la grille tarifaire soit relue.
    invalidatePricingCache();
    invalidateAdCache();
  }

  if (typeof body.placement === "string" && typeof body.priceCents === "number") {
    const price = Math.max(0, Math.round(body.priceCents));
    const model = body.model === "CPM" ? "CPM" : "CPC";
    await prisma.adPlacementPricing.update({
      where: { placement: body.placement },
      data: { priceCents: price, model, updatedBy: adminId },
    });
    invalidatePricingCache();
  }

  return NextResponse.json({ ok: true });
}

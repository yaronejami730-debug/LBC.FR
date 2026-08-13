import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminErrorResponse, requireMobileAdmin } from "@/lib/admin/mobile-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tableau de bord du mode administrateur, côté mobile.
 *
 * Une seule requête, cinq compteurs : c'est ce qu'on regarde en marchant. Le
 * détail de chaque file vit dans sa propre route — l'écran d'accueil n'a pas à
 * charger trois cents annonces pour afficher un chiffre.
 */
export async function GET(req: NextRequest) {
  try {
    await requireMobileAdmin(req);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [pendingListings, reviewListings, openReports, pendingPros, newUsers, newListings] =
      await Promise.all([
        prisma.listing.count({ where: { status: "PENDING", deletedAt: null } }),
        prisma.listing.count({ where: { status: "UNDER_REVIEW", deletedAt: null } }),
        prisma.report.count({ where: { status: "OPEN" } }),
        prisma.proVerification.count({ where: { status: { in: ["PENDING", "INFO_REQUESTED"] } } }),
        prisma.user.count({ where: { createdAt: { gte: since } } }),
        prisma.listing.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      ]);

    return NextResponse.json({
      queues: {
        pendingListings,
        reviewListings,
        openReports,
        pendingPros,
      },
      last24h: { newUsers, newListings },
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

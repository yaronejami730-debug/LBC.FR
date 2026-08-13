import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminErrorResponse, requireMobileAdmin } from "@/lib/admin/mobile-guard";
import {
  approveProCore,
  refuseProCore,
  reinstateProCore,
  requestProInfoCore,
  suspendProCore,
} from "@/lib/moderation/pro-decisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["PENDING", "INFO_REQUESTED", "APPROVED", "REJECTED", "SUSPENDED"];

/**
 * Dossiers d'habilitation professionnelle.
 *
 * Les pièces justificatives ne sortent pas par cette route : une carte
 * d'identité n'a rien à faire dans un cache d'application. Le mobile sert à
 * décider sur les éléments de contexte (entreprise, SIRET, ancienneté,
 * annonces) ; l'examen des pièces reste sur le site.
 */
export async function GET(req: NextRequest) {
  try {
    await requireMobileAdmin(req);
    const status = new URL(req.url).searchParams.get("status") ?? "PENDING";
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: "Statut inconnu." }, { status: 400 });
    }

    const requests = await prisma.proVerification.findMany({
      where: { status },
      orderBy: { submittedAt: "asc" },
      take: 60,
      select: {
        id: true,
        status: true,
        submittedAt: true,
        companyName: true,
        commercialName: true,
        siret: true,
        siretPreviouslyBanned: true,
        businessActivity: true,
        infoRequest: true,
        rejectionReason: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            emailVerified: true,
            phoneVerified: true,
            professionalStatus: true,
            _count: { select: { listings: true } },
          },
        },
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

/** Décision sur un compte : habiliter, demander une pièce, refuser, suspendre. */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireMobileAdmin(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const userId = String(body.userId ?? "");
    const action = String(body.action ?? "");
    const reason = String(body.reason ?? "");

    if (!userId) return NextResponse.json({ error: "Compte requis." }, { status: 400 });
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

    switch (action) {
      case "approve":
        await approveProCore(userId, admin.id);
        return NextResponse.json({ ok: true, status: "APPROVED" });
      case "request-info":
        await requestProInfoCore(userId, admin.id, reason);
        return NextResponse.json({ ok: true, status: "INFO_REQUESTED" });
      case "refuse":
        await refuseProCore(userId, admin.id, reason);
        return NextResponse.json({ ok: true, status: "REJECTED" });
      case "suspend":
        await suspendProCore(userId, admin.id, reason);
        return NextResponse.json({ ok: true, status: "SUSPENDED" });
      case "reinstate":
        await reinstateProCore(userId, admin.id);
        return NextResponse.json({ ok: true, status: "APPROVED" });
      default:
        return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    }
  } catch (error) {
    // Les refus de fond (« motif trop court ») remontent en 400, pas en 500 :
    // c'est une saisie à corriger, pas une panne.
    if (error instanceof Error && /trop court|trop courte|introuvable/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return adminErrorResponse(error);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminErrorResponse, requireMobileAdmin } from "@/lib/admin/mobile-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Signalements ouverts, du plus ancien au plus récent — on traite dans l'ordre. */
export async function GET(req: NextRequest) {
  try {
    await requireMobileAdmin(req);
    const status = new URL(req.url).searchParams.get("status") ?? "OPEN";

    const reports = await prisma.report.findMany({
      where: { status },
      orderBy: { createdAt: "asc" },
      take: 60,
      select: {
        id: true,
        category: true,
        message: true,
        status: true,
        createdAt: true,
        reporter: { select: { id: true, name: true, email: true } },
        subject: { select: { id: true, name: true, email: true } },
        listing: {
          select: { id: true, title: true, images: true, status: true, price: true, userId: true },
        },
      },
    });

    return NextResponse.json({
      reports: reports.map((r) => ({
        ...r,
        listing: r.listing ? { ...r.listing, images: parseImages(r.listing.images) } : null,
      })),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

/**
 * Clôture un signalement.
 *
 * `RESOLVED` veut dire « le signalement disait vrai et j'ai agi », `DISMISSED`
 * « rien à faire ». Les deux ferment la file ; les distinguer permet de
 * mesurer la qualité des signalements plutôt que leur seul volume.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireMobileAdmin(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id ?? "");
    const decision = String(body.decision ?? "");

    if (!id) return NextResponse.json({ error: "Identifiant requis." }, { status: 400 });
    if (decision !== "RESOLVED" && decision !== "DISMISSED") {
      return NextResponse.json({ error: "Décision inconnue." }, { status: 400 });
    }

    const report = await prisma.report.findUnique({ where: { id }, select: { id: true } });
    if (!report) return NextResponse.json({ error: "Signalement introuvable." }, { status: 404 });

    await prisma.report.update({
      where: { id },
      data: { status: decision, resolvedAt: new Date(), resolvedBy: `admin:${admin.id}` },
    });

    return NextResponse.json({ ok: true, status: decision });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

function parseImages(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

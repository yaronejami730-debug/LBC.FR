import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CampaignError, setCampaignBillingExemption } from "@/lib/ads/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 * Exonération de facturation d'une campagne — interrupteur de la régie.
 *
 * `exempt: true` : la campagne est diffusée et mesurée normalement, mais rien
 * n'est débité du portefeuille de l'annonceur, et le budget qu'elle immobilisait
 * est libéré. `exempt: false` : la facturation reprend à l'événement suivant.
 *
 * Jamais rétroactif, dans un sens comme dans l'autre : ce qui a été facturé
 * reste facturé, ce qui a été offert reste offert. Sans cette règle, une facture
 * déjà émise cesserait de correspondre à ce que la base raconte.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { exempt?: unknown; reason?: unknown };

  if (typeof body.exempt !== "boolean") {
    return NextResponse.json({ error: "Indiquez si la campagne est exonérée." }, { status: 400 });
  }

  try {
    const campaign = await setCampaignBillingExemption({
      campaignId: id,
      exempt: body.exempt,
      adminId,
      reason: body.reason ? String(body.reason) : null,
    });
    return NextResponse.json({ campaign });
  } catch (e) {
    if (e instanceof CampaignError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/campaigns] exonération impossible", e);
    return NextResponse.json({ error: "Modification impossible." }, { status: 500 });
  }
}

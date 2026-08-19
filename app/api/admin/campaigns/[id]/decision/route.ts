import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CampaignError, decideCampaign } from "@/lib/ads/campaigns";

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

/** Validation ou refus d'une campagne. Le refus exige un motif. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    approve?: unknown;
    note?: unknown;
    billingExempt?: unknown;
    exemptReason?: unknown;
  };

  try {
    const campaign = await decideCampaign({
      campaignId: id,
      approve: body.approve === true,
      note: body.note ? String(body.note) : null,
      adminId,
      // Exonération décidée au moment de valider : c'est le seul moment où
      // quelqu'un regarde la campagne avant qu'elle parte. Absente, la
      // facturation en place n'est pas touchée.
      billingExempt: typeof body.billingExempt === "boolean" ? body.billingExempt : undefined,
      exemptReason: body.exemptReason ? String(body.exemptReason) : null,
    });
    return NextResponse.json({ campaign });
  } catch (e) {
    if (e instanceof CampaignError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/campaigns] décision impossible", e);
    return NextResponse.json({ error: "Décision impossible." }, { status: 500 });
  }
}

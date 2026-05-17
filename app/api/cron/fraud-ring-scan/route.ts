import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runFraudRingScan } from "@/lib/moderation/jobs";

// Cron quotidien — détecte les clusters de fraude organisée.
// Détection seule : aucun compte n'est restreint automatiquement (risque de
// faux positif). Chaque cluster confirmé crée un `moderationEvent` que l'admin
// traite, puis applique via `npm run moderation:fraud-scan -- --apply`.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runFraudRingScan(prisma, false);

  for (const c of result.clusters) {
    await prisma.moderationEvent
      .create({
        data: {
          actor: "cron:fraud-ring",
          action: "fraud_ring_detected",
          reason: `cluster ${c.root.slice(0, 8)} — ${c.members.length} comptes, liens: ${c.links.join("/")}${c.hasSanctioned ? " (contient un compte sanctionné)" : ""}`,
        } as any,
      })
      .catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    analysed: result.analysed,
    confirmedClusters: result.clusters.length,
    ranAt: new Date().toISOString(),
  });
}

/**
 * GET /api/cron/external-sync
 *
 * Cron toutes les 15 minutes — synchronise chaque `ExternalSource` active
 * via son connecteur (`lib/external-sync.ts`). Met à jour `lastSyncedAt` +
 * `lastResult` (JSON {created, deduped, failed, total, details[]}) pour
 * affichage admin.
 *
 * Authentification : header `Authorization: Bearer ${CRON_SECRET}` —
 * Vercel ajoute ce header automatiquement sur les routes déclenchées par
 * le scheduler (cf. `vercel.json`).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncSource } from "@/lib/external-sync";

export const dynamic = "force-dynamic";
// Une boucle peut être longue (réseau + extraction Claude) ; on autorise jusqu'à 5 min.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sources = await prisma.externalSource.findMany({
    where: { active: true },
    select: { id: true, ownerId: true, url: true, kind: true, label: true },
  });

  type RunResult = {
    sourceId: string;
    label: string;
    created: number;
    deduped: number;
    failed: number;
    total: number;
    error?: string;
  };
  const runs: RunResult[] = [];

  for (const src of sources) {
    try {
      const r = await syncSource(prisma, src);
      runs.push({
        sourceId: src.id,
        label: src.label,
        created: r.created,
        deduped: r.deduped,
        failed: r.failed,
        total: r.total,
      });
      await prisma.externalSource.update({
        where: { id: src.id },
        data: {
          lastSyncedAt: new Date(),
          lastResult: JSON.stringify(r),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      runs.push({
        sourceId: src.id,
        label: src.label,
        created: 0,
        deduped: 0,
        failed: 0,
        total: 0,
        error: msg,
      });
      await prisma.externalSource.update({
        where: { id: src.id },
        data: {
          lastSyncedAt: new Date(),
          lastResult: JSON.stringify({ error: msg }),
        },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    sourcesCount: sources.length,
    runs,
  });
}

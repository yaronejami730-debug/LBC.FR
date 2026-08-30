/**
 * GET /api/cron/external-sync
 *
 * Cron toutes les 3 h (cf. `vercel.json`) — synchronise chaque
 * `ExternalSource` active via son connecteur (`lib/external-sync.ts`). Met à
 * jour `lastSyncedAt` + `lastResult` (JSON {created, deduped, failed, total,
 * disappeared, details[]}) pour affichage admin.
 *
 * Pourquoi pas toutes les 15 minutes (comme l'ancien commentaire le
 * suggérait, alors que la route n'était même pas déclarée dans
 * `vercel.json`) : chaque annonce scrapée déclenche une extraction Claude
 * (`extractListingFromUrl`), y compris celles déjà importées — le coût est
 * donc proportionnel au nombre de passages, pas seulement aux nouveautés.
 * Toutes les 3 h suffit largement pour repérer une nouvelle annonce partenaire
 * dans la journée, pour ~8x moins d'appels qu'un cycle de 15 min.
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
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
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

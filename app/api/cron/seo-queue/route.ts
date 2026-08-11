/**
 * Cron file d'indexation — reconstruit `SeoUrl` à partir de l'univers courant,
 * puis relève auprès de Google l'état des URL les plus prioritaires.
 *
 * Deux temps, volontairement dans le même passage :
 *
 *   1. `syncQueue()` — notre verdict. Quelles URL existent, lesquelles méritent
 *      l'index, lesquelles sont écartées et pourquoi. Rapide, sans réseau.
 *   2. `runInspectionBatch()` — le verdict de Google, en lecture seule. Lent
 *      (une requête HTTP par URL, quota journalier), donc plafonné.
 *
 * Le second dégrade proprement : si l'API Search Console est indisponible ou
 * désactivée, le premier a déjà produit tout ce qu'on peut savoir sans Google.
 */

import { NextRequest, NextResponse } from "next/server";
import { acquireJobLock, releaseJobLock, syncQueue } from "@/lib/seo/queue";
import { runInspectionBatch } from "@/lib/seo/inspection";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const JOB = "queue-sync";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Refus si le secret n'est pas configuré — sinon `Bearer undefined` passerait.
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = await acquireJobLock(JOB);
  if (!runId) {
    return NextResponse.json({ ok: true, skipped: "exécution déjà en cours" });
  }

  try {
    const sync = await syncQueue();

    // Le relevé Google est optionnel : une panne de son côté ne doit pas faire
    // échouer la synchronisation locale, qui elle a réussi.
    const inspection = await runInspectionBatch().catch((err) => {
      console.error("[SEO][queue] relevé Google indisponible :", err);
      return null;
    });

    await releaseJobLock(runId, {
      ok: true,
      processed: sync.total,
      summary: { sync, inspection },
    });

    return NextResponse.json({
      ok: true,
      sync,
      inspection,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[SEO][queue] échec :", message);
    await releaseJobLock(runId, { ok: false, processed: 0, summary: {}, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

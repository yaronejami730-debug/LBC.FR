import { NextResponse, type NextRequest } from "next/server";
import { rollupAdStats } from "@/lib/ads/stats";
import { flushAuctionStats } from "@/lib/ads/auction-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Roulement horaire des statistiques publicitaires.
 *
 * Fenêtre de 48 h plutôt que d'une heure : un cron qui saute — déploiement,
 * incident, quota — ne doit pas laisser un trou définitif dans les chiffres.
 * Le recalcul étant idempotent, repasser sur les mêmes heures ne coûte qu'un
 * peu de temps machine.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  // Les compteurs d'enchères vivent en mémoire entre deux écritures : on les
  // vide avant le roulement, sinon la dernière tranche d'heure manquerait au
  // tableau de bord de l'annonceur.
  await flushAuctionStats().catch(() => null);
  const result = await rollupAdStats(48);
  return NextResponse.json({ ...result, ms: Date.now() - started });
}

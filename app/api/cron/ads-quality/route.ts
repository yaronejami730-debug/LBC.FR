import { NextResponse, type NextRequest } from "next/server";
import { refreshQualityScores } from "@/lib/ads/quality-score";
import { invalidatePerformance } from "@/lib/ads/performance";
import { invalidateAdCache } from "@/lib/ads/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Recalcul quotidien des scores qualité.
 *
 * Une fois par jour, pas à chaque événement : un score qui bouge à chaque clic
 * rendrait le classement instable et le coût par clic imprévisible pour
 * l'annonceur, qui verrait son prix changer sans avoir rien touché.
 *
 * Le moteur garde les campagnes en mémoire trente secondes : la purge évite que
 * les nouveaux scores mettent une demi-minute de plus à s'appliquer.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const result = await refreshQualityScores();
  invalidatePerformance();
  invalidateAdCache();

  return NextResponse.json({ ...result, ms: Date.now() - started });
}

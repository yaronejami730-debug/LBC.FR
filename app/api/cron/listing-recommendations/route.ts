/**
 * Campagne de recommandation locale.
 *
 * Déclenchée par le planificateur, jamais à la publication d'une annonce. Un
 * envoi immédiat produirait dix emails en trente minutes quand dix maisons sont
 * mises en ligne d'affilée ; le passage périodique les regroupe en un seul.
 *
 * Paramètres de requête :
 *   `dryRun=1`         simulation — tout est calculé et journalisé, rien n'est
 *                      envoyé. À utiliser avant chaque mise en production.
 *   `category=maison`  restreint à une catégorie (identifiant ou libellé).
 *   `verbose=1`        renvoie le détail couple par couple (simulation seule).
 */

import { NextResponse } from "next/server";
import { runRecommendationEngine } from "@/lib/recommendations/engine";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.CRON_SECRET;
  if (!expected || (secret !== expected && bearer !== expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = url.searchParams.get("dryRun") === "1";
  const verbose = url.searchParams.get("verbose") === "1";
  const category = url.searchParams.get("category");

  const { geo, campaigns } = await runRecommendationEngine({ category, dryRun });

  return NextResponse.json({
    dryRun,
    geo,
    campaigns: campaigns.map((c) => ({
      campaignId: c.campaignId,
      categoryId: c.categoryId,
      categoryLabel: c.categoryLabel,
      listingCount: c.listingCount,
      candidateUsers: c.candidateUsers,
      targetedUsers: c.targetedUsers,
      emailsSent: c.emailsSent,
      errors: c.errors,
      exclusions: c.exclusions,
      // Le détail n'est renvoyé qu'en simulation explicite : il contient des
      // adresses email et n'a rien à faire dans une réponse de production.
      ...(dryRun && verbose ? { lines: c.lines.slice(0, 500) } : {}),
    })),
  });
}

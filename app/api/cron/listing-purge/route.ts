import { NextResponse } from "next/server";
import { purgeExpiredListings, REMOVAL_RETENTION_DAYS } from "@/lib/moderation/removal";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Destruction définitive des annonces dont le délai de conservation est écoulé.
 *
 * Le délai n'a de sens que si quelque chose l'applique : sans cette tâche, une
 * annonce retirée resterait en base indéfiniment et la promesse faite à
 * l'utilisateur (« supprimée définitivement le … ») serait fausse.
 *
 * Le lot est borné à 200 annonces par passage. Une exécution qui expire au
 * milieu d'une suppression laisserait des fichiers effacés et des lignes
 * intactes ; mieux vaut plusieurs passages courts, le cron repasse chaque jour.
 */
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.CRON_SECRET;
  if (!expected || (secret !== expected && bearer !== expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await purgeExpiredListings(200);

  return NextResponse.json({
    retentionDays: REMOVAL_RETENTION_DAYS,
    ...result,
  });
}

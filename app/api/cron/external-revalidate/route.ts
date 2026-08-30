/**
 * GET /api/cron/external-revalidate
 *
 * Cron toutes les 2 h — revalide un lot d'annonces importées depuis une
 * source externe, quelle que soit la façon dont elles ont été importées.
 *
 * `lib/external-sync.ts` (cron `external-sync`) ne voit que les annonces
 * rattachées à un `ExternalSource` — 6 sur 129. Les 123 autres viennent
 * d'imports unitaires (`importListingByUrl`) sans source associée : le seul
 * fil qui les relie toutes est `metadata.sourceUrl`, présent sur chacune.
 * C'est donc ici, et non dans `external-sync`, que vit la revalidation
 * couvrant l'ensemble du parc importé. Voir `lib/external-revalidate.ts`
 * pour la logique complète (détection de disparition, distinction
 * vendu/injoignable, comparaison de prix).
 *
 * Authentification : header `Authorization: Bearer ${CRON_SECRET}` — même
 * motif que `app/api/cron/external-sync/route.ts`, Vercel l'ajoute
 * automatiquement sur les routes déclenchées par le scheduler.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateExternalListings } from "@/lib/external-revalidate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 40 annonces × jusqu'à 8 s de timeout réseau chacune, par sous-lots de 8 en
// parallèle : ~40 s dans le pire des cas. 300 s de marge, comme les autres
// crons qui touchent au réseau externe (`external-sync`).
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await revalidateExternalListings(prisma);

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    ...summary,
  });
}

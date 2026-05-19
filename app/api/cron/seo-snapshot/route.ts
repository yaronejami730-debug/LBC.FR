import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  topQueries,
  topPages,
  emergingKeywords,
  siteTotals,
} from "@/lib/seo/search-console";

// Cron quotidien — capture les données Google Search Console dans un
// `SeoSnapshot`. L'historique des snapshots est la mémoire de l'IA SEO :
// il permet de comparer les fenêtres dans le temps et de faire ressortir
// tendances, mots-clés émergents et dérive de position.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Décale la date du jour de N jours, renvoie "YYYY-MM-DD". */
function shiftDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Refus si le secret n'est pas configuré — sinon `Bearer undefined` passerait.
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // `emerging` est le plus coûteux (2 requêtes) — tout en parallèle.
  const [totals, queries, pages, emerging] = await Promise.all([
    siteTotals(28),
    topQueries(28, 500),
    topPages(28, 500),
    emergingKeywords(14, 20),
  ]);

  const snapshot = await prisma.seoSnapshot.create({
    data: {
      startDate: shiftDate(-31),
      endDate: shiftDate(-3),
      clicks: totals.clicks,
      impressions: totals.impressions,
      ctr: totals.ctr,
      position: totals.position,
      topQueriesJson: JSON.stringify(queries),
      topPagesJson: JSON.stringify(pages),
      // `growth` peut valoir Infinity — non sérialisable en JSON, on plafonne.
      emergingJson: JSON.stringify(
        emerging.map((k) => ({
          ...k,
          growth: Number.isFinite(k.growth) ? k.growth : 999,
        })),
      ),
    },
  });

  return NextResponse.json({
    ok: true,
    snapshotId: snapshot.id,
    clicks: totals.clicks,
    impressions: totals.impressions,
    queries: queries.length,
    pages: pages.length,
    emerging: emerging.length,
    ranAt: new Date().toISOString(),
  });
}

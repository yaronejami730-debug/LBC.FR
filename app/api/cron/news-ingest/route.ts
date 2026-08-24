import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { attachAuthors, ingestAll, purgeOldNews } from "@/lib/news/ingest";
import { pingIndexNow } from "@/lib/indexnow";
import { getNewsFeed } from "@/lib/news/articles";

/**
 * Captation des flux de presse, toutes les heures.
 *
 * ── Pourquoi cette fréquence, et ce qu'elle achète ────────────────────────
 *
 * Un article paru à 9 h doit être sur le site à 10 h, pas le lendemain : c'est
 * ce qui rend le fil crédible pour un visiteur, et c'est ce qui donne au fil un
 * rythme de mise à jour qu'un moteur peut apprendre.
 *
 * Chaque passage fait trois choses au-delà de la captation :
 *
 *   1. `revalidateTag("news")` — les pages se régénèrent au lieu d'attendre
 *      l'expiration de leur cache ;
 *   2. un envoi IndexNow sur les nouvelles adresses — signalement immédiat,
 *      pris en compte par Bing et Yandex ;
 *   3. le flux Atom `/actualites/feed.xml` se réécrit, et c'est lui que Google
 *      relit — le ping de sitemap n'existe plus depuis 2023.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reports = await ingestAll();
  const authors = await attachAuthors();
  const purged = await purgeOldNews();

  const created = reports.reduce((n, r) => n + r.created, 0);

  // Les blocs d'actualité sont en cache d'une heure. Après captation, on les
  // invalide : sans cela, une actualité captée à 8 h n'apparaîtrait qu'à 9 h.
  revalidateTag("news");

  // Signalement uniquement s'il y a du neuf. Annoncer les mêmes URL à chaque
  // passage horaire est le meilleur moyen de ne plus être écouté.
  if (created > 0) {
    const fresh = await getNewsFeed(null, Math.min(created, 20));
    await pingIndexNow([
      "https://www.dealandcompany.fr/actualites",
      ...fresh.map((a) => `https://www.dealandcompany.fr/actualites/${a.slug}`),
    ]);
  }

  const failed = reports.filter((r) => r.error);
  return NextResponse.json(
    {
      ok: failed.length === 0,
      reports,
      authors,
      purged,
      created,
    },
    // Un flux en échec ne casse pas le cron : 200 avec `ok: false`, le
    // détail est dans le corps. Un 500 déclencherait une alerte pour une
    // indisponibilité qui ne nous appartient pas.
    { status: 200 },
  );
}

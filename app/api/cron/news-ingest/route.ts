import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { attachAuthors, ingestAll, purgeOldNews } from "@/lib/news/ingest";
import { pingIndexNow } from "@/lib/indexnow";
import { getNewsFeed } from "@/lib/news/articles";

/**
 * Captation des flux de presse, tous les quarts d'heure.
 *
 * ── Pourquoi ce rythme, et ce qu'il achète ────────────────────────────────
 *
 * Un article paru à 9 h doit être sur le site à 9 h 15, pas le lendemain :
 * c'est ce qui rend le fil crédible pour un visiteur, et c'est ce qui donne au
 * fil une cadence qu'un moteur peut apprendre.
 *
 * Descendre encore — toutes les minutes — n'apporterait rien : les rédactions
 * republient leur flux à un rythme de l'ordre du quart d'heure, et taper quatre
 * fois plus souvent chez un média qui nous rend service en publiant un flux
 * ouvert est le meilleur moyen de s'en faire refuser l'accès.
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
  const quoted = reports.reduce((n, r) => n + r.quoted, 0);
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
      // Citations obtenues en ouvrant la page du média : le budget d'un passage
      // est borné, ce chiffre dit ce qu'il en reste à rattraper au suivant.
      quoted,
    },
    // Un flux en échec ne casse pas le cron : 200 avec `ok: false`, le
    // détail est dans le corps. Un 500 déclencherait une alerte pour une
    // indisponibilité qui ne nous appartient pas.
    { status: 200 },
  );
}

import { getNewsFeed } from "@/lib/news/articles";

/**
 * Notre propre flux Atom — `/actualites/feed.xml`.
 *
 * ── C'est *le* mécanisme de fraîcheur ─────────────────────────────────────
 *
 * Google a supprimé le ping de sitemap en 2023 : il n'existe plus de bouton
 * « viens voir, j'ai publié ». Ce qu'il documente en revanche, c'est qu'un flux
 * RSS ou Atom soumis comme sitemap est le moyen recommandé pour signaler du
 * contenu qui change souvent — un flux est court, il ne liste que le récent, et
 * il est relu bien plus souvent qu'un sitemap complet.
 *
 * Ce flux ne liste donc **que les vingt derniers articles**, avec leur date de
 * mise à jour réelle. Y mettre tout l'historique reviendrait à en faire un
 * second sitemap, et lui retirerait exactement ce qui le rend utile.
 *
 * À faire une fois, à la main : le déclarer dans Search Console comme sitemap.
 */
export const revalidate = 900;

const BASE = "https://www.dealandcompany.fr";

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const articles = await getNewsFeed(null, 20);
  const updated = articles[0]?.publishedAt ?? new Date();

  const entries = articles
    .map((a) => {
      const url = `${BASE}/actualites/${a.slug}`;
      return `  <entry>
    <title>${escape(a.title)}</title>
    <link rel="alternate" href="${escape(url)}"/>
    <id>${escape(url)}</id>
    <updated>${a.publishedAt.toISOString()}</updated>
    <published>${a.publishedAt.toISOString()}</published>
    <author><name>${escape(a.authorName ?? a.publisher)}</name></author>
    <source><title>${escape(a.publisher)}</title></source>${
      a.summary ? `\n    <summary type="text">${escape(a.summary)}</summary>` : ""
    }
  </entry>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Deal&amp;Co Info</title>
  <link rel="alternate" href="${BASE}/actualites"/>
  <link rel="self" href="${BASE}/actualites/feed.xml"/>
  <id>${BASE}/actualites</id>
  <updated>${updated.toISOString()}</updated>
${entries}
</feed>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      // Court, et revalidation en arrière-plan : un crawler qui repasse toutes
      // les dix minutes doit trouver du frais sans jamais frapper la base.
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}

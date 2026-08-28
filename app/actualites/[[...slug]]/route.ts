import { NextResponse } from "next/server";

/**
 * `410 Gone` sur tout ce qui reste de la section « actualités ».
 *
 * ── Pourquoi une route, et pas simplement laisser la 404 ──────────────────
 *
 * La section a été supprimée par le commit 41dd714, avec la migration
 * `20260826200000_drop_news`. Le dossier `app/actualites/` n'existe plus, donc
 * Next sert déjà `app/not-found.tsx` — correctement, et vite : le relevé du
 * 28/08 mesure 147 ms de moyenne sur les 412 URL concernées. Rien n'est cassé.
 *
 * Ce que la 404 ne dit pas, c'est que c'est définitif. Pour Google, une 404
 * signifie « absente aujourd'hui » : il revient, plusieurs fois, pendant des
 * semaines, avant de retirer l'URL de son index. Une 410 signifie « retirée,
 * ne reviens pas » et déclenche la désindexation dès la première lecture. Sur
 * 386 URL que Googlebot recharge actuellement, l'écart se prend directement
 * sur le budget d'exploration des pages qui, elles, doivent être vues.
 *
 * ── Ce que cette route ne couvre pas ──────────────────────────────────────
 *
 * `/actualites/marque/:marque` est redirigé en 301 vers
 * `/annonces/vehicules/:marque` par `next.config.ts`. Les redirections y sont
 * appliquées par la couche de routage, avant que cette route ne soit atteinte :
 * les vingt-six URL de marques ne passent jamais ici.
 *
 * ── Pourquoi 410 et pas une redirection pour le reste ─────────────────────
 *
 * Les 380 URL restantes sont des articles de presse syndiquée — ressources
 * humaines, sport, politique, espace — et 6 sont leurs rubriques. Aucune n'a
 * d'équivalent sur une place de marché de petites annonces. Les rediriger vers
 * une catégorie produirait un soft-404 : Google compare la page d'arrivée au
 * sujet demandé, ne le trouve pas, traite la redirection comme une erreur, et
 * la compte contre le domaine. Quand il n'existe pas de page équivalente, la
 * réponse honnête est qu'il n'y en a pas.
 *
 * ⚠️ Si Search Console montre du trafic historique sur l'une de ces URL
 * (`npm run seo:404-triage`), c'est cette page-là qu'il faut recréer ou
 * rediriger nommément — la 410 ne se discute que cas par cas.
 */
export const dynamic = "force-static";

function gone() {
  return new NextResponse(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">` +
      `<meta name="robots" content="noindex">` +
      `<title>Page supprimée — Deal&amp;Co</title></head>` +
      `<body><h1>Page supprimée</h1>` +
      `<p>La section actualités n'existe plus.</p>` +
      `<p><a href="/">Accueil</a> — <a href="/annonces">Voir les annonces</a></p>` +
      `</body></html>`,
    {
      status: 410,
      headers: {
        "content-type": "text/html; charset=utf-8",
        // Une suppression définitive peut être mise en cache longtemps : c'est
        // exactement l'information qu'on veut que le CDN serve sans réveiller
        // l'origine à chaque passage de robot.
        "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
        "x-robots-tag": "noindex",
      },
    },
  );
}

export const GET = gone;
export const HEAD = gone;

import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

/**
 * Content-Security-Policy — phase d'observation.
 *
 * Envoyée en `Report-Only` : le navigateur ne bloque rien, il signale à
 * `/api/csp-report`. C'est délibéré. Le site charge AdSense, Google Analytics,
 * Google Fonts, des cartes Google et les CDN d'une dizaine d'agences ; une
 * politique écrite de mémoire puis activée d'un coup coupe la publicité ou les
 * photos d'annonces sans que personne ne s'en aperçoive avant plusieurs jours.
 *
 * Les directives ci-dessous couvrent tout ce que l'inventaire du code a
 * remonté. Elles restent volontairement larges là où le risque est faible
 * (`img-src https:` — les régies servent des visuels depuis des domaines
 * imprévisibles) et strictes là où il ne l'est pas (`object-src 'none'`,
 * `base-uri 'self'` qui empêche un `<base>` injecté de détourner tous les
 * liens relatifs de la page).
 *
 * `'unsafe-inline'` sur les scripts est un compromis assumé de cette phase :
 * Next injecte ses propres scripts en ligne, et le passage aux nonces demande
 * de traverser le rendu. À faire une fois les rapports stabilisés — c'est ce
 * qui donnera à la CSP sa vraie valeur contre l'injection.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // Régies et mesure d'audience.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.adtrafficquality.google https://va.vercel-scripts.com",
  // Google Fonts + styles en ligne (attributs `style` de React, next/image).
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Les créations publicitaires viennent de domaines arbitraires : restreindre
  // ici couperait la monétisation pour un gain de sécurité quasi nul, une image
  // n'exécutant rien.
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.google-analytics.com https://*.analytics.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.adtrafficquality.google https://vitals.vercel-insights.com https://exp.host",
  // Cartes Google sur les fiches d'annonces + cadres publicitaires.
  "frame-src 'self' https://maps.google.com https://www.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.adtrafficquality.google",
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "report-uri /api/csp-report",
  "report-to csp",
].join("; ");

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // `frame-ancestors` est ignoré dans une policy Report-Only : la seule
  // directive du lot qu'on applique donc pour de vrai, en doublon moderne de
  // X-Frame-Options.
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
  // Canal moderne de signalement ; `report-uri` reste pour les navigateurs
  // qui ne l'implémentent pas encore.
  {
    key: "Reporting-Endpoints",
    value: 'csp="/api/csp-report"',
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "@opensearch-project/opensearch", "tesseract.js"],
  // Tree-shake agressif sur les gros packages avec barrel files.
  experimental: {
    optimizePackageImports: [
      "next-auth",
      "@supabase/supabase-js",
      "lucide-react",
      "date-fns",
    ],
  },
  images: {
    // WebP uniquement : l'encodage AVIF est 5-10x plus lent côté serveur.
    // Pour des photos d'agences externes (CDN arbitraires, cache froid), le
    // ré-encodage AVIF à la volée domine la latence du 1er chargement.
    // WebP donne ~95% des gains de poids pour une fraction du coût CPU.
    formats: ["image/webp"],
    // Cache CDN long → après le 1er encodage, plus aucune ré-optimisation.
    minimumCacheTTL: 60 * 60 * 24 * 365,
    // Moins de points de rupture = moins de variantes à encoder/cacher.
    deviceSizes: [640, 750, 1080, 1920],
    imageSizes: [128, 256, 384],
    // Qualité 70 : invisible sur des photos d'annonces, ~25% plus léger.
    qualities: [70, 75],
    /**
     * Hôtes autorisés pour l'optimiseur d'images.
     *
     * `hostname: "**"` ouvrait `/_next/image?url=…` à n'importe quelle adresse :
     * le serveur allait chercher l'URL fournie par l'appelant et en renvoyait
     * le contenu ré-encodé. C'est un proxy de récupération gratuit — bande
     * passante offerte à qui la demande, et fenêtre de reconnaissance sur tout
     * ce que le serveur peut joindre.
     *
     * L'argument d'origine (« les CDN d'agences sont imprévisibles ») était
     * juste sur le principe et faux en pratique : un inventaire des 318 annonces
     * et de toutes les fiches pro donne **10 hôtes distincts**, tous connus. Les
     * jokers portent donc sur les sous-domaines, pas sur le domaine.
     *
     * ⚠️ Ajouter une source externe (`ExternalSource`) hébergée ailleurs impose
     * d'ajouter son hôte ici, sinon ses photos ne s'afficheront pas.
     */
    remotePatterns: [
      // Notre propre stockage.
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      // Agences automobiles.
      { protocol: "https", hostname: "agenceauto.com" },
      { protocol: "https", hostname: "**.agenceauto.com" },
      { protocol: "https", hostname: "**.auto-gestion.net" },
      { protocol: "https", hostname: "**.simplicicar.com" },
      // Agences immobilières.
      { protocol: "https", hostname: "**.staticlbi.com" },
      { protocol: "https", hostname: "bskimmobilier.com" },
      { protocol: "https", hostname: "**.bskimmobilier.com" },
      { protocol: "https", hostname: "**.paruvendu.fr" },
      // CDN public mutualisé utilisé par plusieurs sources importées.
      { protocol: "https", hostname: "**.cloudfront.net" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // SEO landing pages — long edge cache + SWR so Googlebot gets a fast TTFB
      // and content stays fresh enough (revalidate hourly, serve stale up to 1d).
      {
        source: "/annonces/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/ville/:slug",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/prix/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/annonce/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=600, stale-while-revalidate=86400",
          },
        ],
      },
      /**
       * Les deux familles éditoriales véhicules n'avaient aucune règle.
       *
       * `/annonces`, `/ville`, `/prix`, `/annonce` et `/u` en ont une chacune ;
       * `/voiture` et `/voiture-budget` ont été oubliées. Elles s'en tiraient
       * parce que leur `revalidate` interne produit déjà un `s-maxage`, mais
       * leurs pages paginées `/page/N`, rendues à la demande, n'héritaient de
       * rien et sortaient en `private, no-cache, no-store` — mesuré le
       * 28/08/2026 sur la version de production locale.
       *
       * Une page de pagination est `noindex`, mais Googlebot la parcourt
       * quand même pour atteindre les annonces qu'elle liste : la laisser
       * hors cache fait payer à l'origine chaque pas de cette traversée.
       */
      {
        source: "/voiture/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/voiture-budget/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/u/:id",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=1800, stale-while-revalidate=86400",
          },
        ],
      },
      /**
       * Fiches pro — seule route de fiche du site sans règle jusqu'ici.
       *
       * Mesuré en production le 28/08/2026 : `private, no-cache, no-store`,
       * `x-vercel-cache: MISS` systématique, TTFB 1,0-1,4 s contre 220-340 ms
       * sur `/annonces`, `/ville`, `/annonce`. `s-maxage=1800` reprend le
       * `revalidate` déclaré dans `app/pro/[slug]/page.tsx` — les deux couches
       * de cache doivent expirer ensemble, voir le commentaire de ce fichier.
       */
      {
        source: "/pro/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=1800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/sitemap.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=1800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/sitemap/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=1800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/rss.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=900, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      /**
       * Domaine sans www → domaine canonique, en **308 permanent**.
       *
       * Le crawl du 23/08/2026 a mesuré un 307 sur `https://dealandcompany.fr/`.
       * Un 307 est temporaire : Google garde l'ancienne URL dans son index,
       * n'y transfère pas le signal, et continue de vérifier les deux versions.
       * Sur un domaine jeune, c'est l'autorité qui reste coupée en deux.
       *
       * Attention à ce que cette règle couvre et ne couvre pas. Le 307 constaté
       * est émis par Vercel **avant** l'application, au niveau du domaine du
       * projet : la requête n'atteint jamais ce fichier, et cette règle ne le
       * corrige donc pas à elle seule. Le réglage se change dans le projet
       * Vercel qui détient le domaine (voir `docs/seo-www-redirect.md`).
       *
       * Elle reste utile pour deux raisons : le jour où l'apex est rattaché au
       * projet comme domaine servi plutôt que comme redirection, la
       * redirection permanente existe déjà ; et tout autre hébergement de cette
       * application se comporte correctement sans configuration.
       */
      {
        source: "/:path*",
        has: [{ type: "host", value: "dealandcompany.fr" }],
        destination: "https://www.dealandcompany.fr/:path*",
        permanent: true,
      },
      { source: "/listing/:id", destination: "/annonce/:id", permanent: true },
      { source: "/listing/:id/edit", destination: "/annonce/:id/edit", permanent: true },
      // Short brand aliases — funnel SEO juice to canonical /annonces/vehicules/{marque}
      { source: "/marque/:slug", destination: "/annonces/vehicules/:slug", permanent: true },
      { source: "/auto/:slug", destination: "/annonces/vehicules/:slug", permanent: true },
      { source: "/autos/:slug", destination: "/annonces/vehicules/:slug", permanent: true },
      // City shortcut alias
      { source: "/villes/:slug", destination: "/ville/:slug", permanent: true },

      /**
       * Section « actualités » retirée — ce qu'il en reste dans l'index Google.
       *
       * Le commit 41dd714 a supprimé tout `app/actualites/`, en même temps que
       * la migration `20260826200000_drop_news`. Google, lui, garde les URL :
       * elles lui avaient été soumises le 24/08, deux jours avant la
       * suppression. Le relevé du 28/08 en compte **412 encore en 404**.
       *
       * Une seule des trois formes a un équivalent honnête. `/actualites/marque/audi`
       * parlait des voitures Audi ; `/annonces/vehicules/audi` en vend. Même
       * marque, même intention, page réelle : c'est une redirection, pas un
       * repli. Dix-sept des vingt-six marques concernées ont du stock et
       * répondent 200 ; les neuf autres (alpine, aston-martin, bentley,
       * ferrari, honda, lamborghini, maserati, mazda, seat) répondent 404 faute
       * d'annonces, ce qui est le même résultat qu'aujourd'hui — et se répare
       * tout seul dès qu'une annonce arrive.
       *
       * Les 386 autres URL — 380 articles de presse syndiquée, 6 rubriques —
       * n'ont aucun équivalent. Les rediriger vers une catégorie fabriquerait
       * un soft-404 : Google compare la page d'arrivée à la requête, ne trouve
       * rien du sujet demandé, et traite la redirection comme une erreur tout
       * en la comptant contre nous. Elles sont traitées en 410 par
       * `app/actualites/[[...slug]]/route.ts`.
       *
       * Cette règle est placée avant : une redirection de `next.config` est
       * appliquée par la couche de routage, avant qu'aucune route ne soit
       * atteinte.
       */
      {
        source: "/actualites/marque/:marque",
        destination: "/annonces/vehicules/:marque",
        permanent: true,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);

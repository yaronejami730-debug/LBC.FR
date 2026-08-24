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
      // Revue de presse : visuels publiés par les médias dans leurs propres
      // flux (`<enclosure>`) et miniatures YouTube. Deux hôtes connus, pas de
      // joker de domaine — la règle du fichier reste la même.
      { protocol: "https", hostname: "cdn.motor1.com" },
      { protocol: "https", hostname: "**.ytimg.com" },
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
      {
        source: "/u/:id",
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
    ];
  },
};

export default withBundleAnalyzer(nextConfig);

import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Pas de CSP strict pour éviter de casser les ressources externes (Google Fonts, images ads…)
  // Les headers ci-dessus suffisent pour les protections essentielles
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
    // AVIF en 1er → -30% de poids vs WebP/JPEG sur navigateurs modernes,
    // fallback automatique pour les anciens.
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Annonces importées de sources externes (agences) → photos hébergées sur
    // des CDN/domaines arbitraires et imprévisibles. On autorise donc tout host
    // HTTPS plutôt que d'énumérer chaque agence. next/image ne charge que des
    // images et les ré-encode — surface limitée.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
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

import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";
import VisitorTracker from "@/components/VisitorTracker";
import EventTracker from "@/components/EventTracker";
import CookieBanner from "@/components/CookieBanner";
import { AppStoreBanner } from "@/components/AppStoreBanner";

const GA_ID = "G-31WRQ5YXX6";
const ADSENSE_CLIENT = "ca-pub-1774647148412256";

// Weights réduits au strict nécessaire : -200 KB sur le critical path.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["700", "800"], // utilisé uniquement pour les titres/headlines
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Deal&Co — Petites annonces gratuites entre particuliers en France",
    template: "%s | Deal&Co",
  },
  description:
    "Achetez et vendez d'occasion près de chez vous sur Deal&Co. Voitures, immobilier, mode, électronique — petites annonces gratuites entre particuliers partout en France.",
  metadataBase: new URL("https://www.dealandcompany.fr"),
  alternates: {
    canonical: "https://www.dealandcompany.fr",
    languages: {
      "fr-FR": "https://www.dealandcompany.fr",
      "x-default": "https://www.dealandcompany.fr",
    },
    types: {
      "application/rss+xml": "https://www.dealandcompany.fr/rss.xml",
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  verification: {
    google: "8N5Ojonm2AEamRcn_DoTTdkvL1KlGbObhKrqDUorZ5E",
    other: { "google-adsense-account": ADSENSE_CLIENT },
  },
  openGraph: {
    title: "Deal&Co — Petites annonces gratuites entre particuliers",
    description:
      "Achetez et vendez d'occasion près de chez vous. Voitures, immobilier, mode, électronique — petites annonces gratuites entre particuliers.",
    url: "https://www.dealandcompany.fr",
    siteName: "Deal&Co",
    type: "website",
    locale: "fr_FR",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Deal&Co — Petites annonces gratuites",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Deal&Co — Petites annonces gratuites entre particuliers",
    description:
      "Achetez et vendez d'occasion près de chez vous. Voitures, immobilier, mode, électronique — petites annonces gratuites.",
    images: ["/opengraph-image"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2f6fb8",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="light">
      <head>
        {/* Material Symbols — icon font, no next/font support. Preconnect cuts handshake cost. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Deal&Co — Dernières annonces"
          href="/rss.xml"
        />
        <link rel="apple-touch-icon" href="/logo.png" />
        {/* Material Symbols — range réduit (400 + FILL 0..1) → fichier ~5× plus
            petit. Le preload accélère le téléchargement ; le stylesheet est
            chargé normalement (le truc print+onLoad ne fonctionne pas en JSX :
            React ne propage pas un onLoad sous forme de chaîne au DOM). */}
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@400,0..1&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@400,0..1&display=swap"
        />
      </head>
      <body className={`${inter.variable} ${manrope.variable}`}>
        {/* Consent Mode v2 — default DENIED for EEA/CNIL compliance.
            Must run BEFORE GA/AdSense load so cookies are not set until
            CookieBanner explicitly updates consent. */}
        <Script id="consent-default" strategy="beforeInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500
});
var m = document.cookie.match(/(?:^|; )consent_v1=([^;]*)/);
if (m && decodeURIComponent(m[1]) === 'granted') {
  gtag('consent', 'update', {
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
    analytics_storage: 'granted'
  });
}`}
        </Script>
        {/* GA + AdSense : lazyOnload → exécution après `window.onload`,
            le main thread reste libre pour LCP/TBT. */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="lazyOnload"
        />
        <Script id="ga-init" strategy="lazyOnload">
          {`gtag('js', new Date());
gtag('config', '${GA_ID}');`}
        </Script>
        <Script
          id="adsense"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
        <VisitorTracker />
        <EventTracker />
        <AppStoreBanner />
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}

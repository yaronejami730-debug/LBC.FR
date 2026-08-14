import type { Metadata } from "next";
import { inter, manrope } from "./fonts";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";
import VisitorTracker from "@/components/VisitorTracker";
import EventTracker from "@/components/EventTracker";
import CookieBanner from "@/components/CookieBanner";
import { AppStoreBanner } from "@/components/AppStoreBanner";

const GA_ID = "G-31WRQ5YXX6";
const ADSENSE_CLIENT = "ca-pub-1774647148412256";

export const metadata: Metadata = {
  title: {
    default: "Deal&Co — Petites annonces gratuites entre particuliers en France",
    template: "%s | Deal&Co",
  },
  description:
    "Achetez et vendez d'occasion près de chez vous sur Deal&Co. Voitures, immobilier, mode, électronique — petites annonces gratuites entre particuliers partout en France.",
  metadataBase: new URL("https://www.dealandcompany.fr"),
  alternates: {
    // Volontairement **pas** de `canonical` ici.
    //
    // Un canonical posé au niveau du layout est hérité par toute page qui n'en
    // déclare pas — et les branches `noindex` de `generateMetadata` n'en
    // déclaraient pas. Le crawl du 11/08 a compté **191 URL sur 362** annonçant
    // la page d'accueil comme leur version canonique : chaque page mince, chaque
    // 404 et chaque annonce importée se présentait à Google comme un duplicata
    // de la racine. C'est le signal de duplication le plus destructeur qu'un
    // domaine puisse émettre sur lui-même.
    //
    // Chaque page pose désormais son propre canonical auto-référent. La page
    // d'accueil le fait dans `app/page.tsx`.
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
            petit.

            La feuille était chargée en `media="print"`, puis un script inline la
            repassait en `all` une fois arrivée : un classique pour ne pas
            bloquer le premier rendu. Ça ne tient pas dans l'App Router.

            Le `<link>` est un élément React, et React le re-rend à sa valeur du
            JSX — `print` — lors des navigations côté client. Le script inline,
            lui, ne s'exécute qu'au chargement initial du document. Après un
            aller-retour entre deux pages, la feuille repassait donc en `print`
            et la police cessait d'être appliquée, sans que rien ne la remette.
            L'attribut `data-icons="ready"`, posé une fois pour toutes sur
            `<html>`, restait en place et levait le masque : le nom de la
            ligature s'affichait en toutes lettres — « person », « storefront »,
            « visibility » — à la place de chaque icône.

            D'où le retour à un `<link>` ordinaire. Le coût réel est faible :
            `preconnect` supprime le DNS et le TLS du chemin critique, et
            `display=swap` laisse le texte s'afficher pendant le téléchargement.
            Surtout, l'attribut `media` ne change plus jamais — il n'y a donc
            plus rien qu'un re-rendu puisse défaire. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@400,0..1&display=swap"
        />
        {/* Marque `data-icons="ready"` une fois la police réellement utilisable.
            Tant que ce marqueur est absent, `globals.css` garde les ligatures
            invisibles — sinon le nom de l'icône s'affiche pendant le
            chargement.

            La détection passe par `document.fonts`, qui interroge l'état réel
            de la police et non celui d'une balise : aucune course possible avec
            un événement `load` déjà tiré, et aucune dépendance à un élément que
            React pourrait remplacer. Le repli à 2 s garantit que les icônes
            réapparaissent même si Google Fonts ne répond pas. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var d=document;var r=function(){d.documentElement.setAttribute('data-icons','ready')};" +
              "if(d.fonts&&d.fonts.load){d.fonts.load('24px \"Material Symbols Outlined\"').then(r).catch(r)}else{r()}" +
              "setTimeout(r,2000)})()",
          }}
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

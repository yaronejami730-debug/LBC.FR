import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import VisitorTracker from "@/components/VisitorTracker";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
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
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  verification: {
    google: "8N5Ojonm2AEamRcn_DoTTdkvL1KlGbObhKrqDUorZ5E",
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
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="light">
      <head>
        {/* Material Symbols — icon font, no next/font support */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.variable} ${manrope.variable}`}>
        <VisitorTracker />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

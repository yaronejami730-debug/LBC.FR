import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Deal&Co — Petites annonces gratuites",
    short_name: "Deal&Co",
    description:
      "Achetez et vendez d'occasion entre particuliers en France. Voitures, immobilier, mode, électronique — petites annonces gratuites.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2f6fb8",
    lang: "fr-FR",
    orientation: "portrait",
    categories: ["shopping", "lifestyle", "marketplace"],
    icons: [
      {
        src: "/logo.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo.png",
        sizes: "any",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

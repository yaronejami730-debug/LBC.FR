import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/post", "/profile", "/messages", "/favoris"],
      },
    ],
    sitemap: "https://www.dealandcompany.fr/sitemap.xml",
    host: "https://www.dealandcompany.fr",
  };
}

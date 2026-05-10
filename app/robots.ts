import type { MetadataRoute } from "next";

const PRIVATE_PATHS = ["/admin", "/api/", "/post", "/profile", "/messages", "/favoris", "/recherches"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }],
    sitemap: "https://www.dealandcompany.fr/sitemap.xml",
    host: "https://www.dealandcompany.fr",
  };
}

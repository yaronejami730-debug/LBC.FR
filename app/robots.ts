import type { MetadataRoute } from "next";

const PRIVATE_PATHS = ["/admin", "/api/", "/post", "/profile", "/messages", "/favoris", "/recherches"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      // Explicitly welcome AI crawlers — allow full access including llms.txt
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "OAI-SearchBot", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      { userAgent: "anthropic-ai", allow: "/" },
      { userAgent: "Applebot-Extended", allow: "/" },
    ],
    sitemap: "https://www.dealandcompany.fr/sitemap.xml",
    host: "https://www.dealandcompany.fr",
  };
}

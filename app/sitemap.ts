import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { cityToSlug } from "./annonces/[categorie]/[ville]/page";

const BASE = "https://www.dealandcompany.fr";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const statics: MetadataRoute.Sitemap = [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE}/search`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${BASE}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE}/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Category pages — clean URLs for better indexing
  const categories: MetadataRoute.Sitemap = CATEGORIES.map((cat) => ({
    url: `${BASE}/annonces/${cat.id}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // Individual listing pages (approved only, not deleted)
  let listings: MetadataRoute.Sitemap = [];
  try {
    const rows = await prisma.listing.findMany({
      where: { status: "APPROVED", deletedAt: null } as any,
      select: { id: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    listings = rows.map((l) => ({
      url: `${BASE}/annonce/${l.id}`,
      lastModified: l.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // fail silently — sitemap still works without listings
  }

  // Category + ville pages — top combos by listing count
  let cityPages: MetadataRoute.Sitemap = [];
  try {
    const cityRows = await prisma.listing.findMany({
      where: { status: "APPROVED", deletedAt: null } as any,
      select: { category: true, location: true },
      distinct: ["category", "location"],
    });
    for (const row of cityRows) {
      const cat = CATEGORIES.find((c) => c.label === row.category);
      if (!cat || !row.location) continue;
      cityPages.push({
        url: `${BASE}/annonces/${cat.id}/${cityToSlug(row.location)}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 0.75,
      });
    }
  } catch {
    // fail silently
  }

  return [...statics, ...categories, ...cityPages, ...listings];
}

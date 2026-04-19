import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { FRENCH_CITIES, TOP_CITIES, citySlug } from "@/lib/cities";
import { subcategoryToSlug } from "@/lib/seo-content";

const BASE = "https://www.dealandcompany.fr";
const PRIORITY_CATEGORIES = ["vehicules", "immobilier", "multimedia", "mode", "maison"];
const PRIORITY_LONGTAIL_CITIES = TOP_CITIES.slice(0, 15);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const statics: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/search`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const categories: MetadataRoute.Sitemap = CATEGORIES.map((cat) => ({
    url: `${BASE}/annonces/${cat.id}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const cityPages: MetadataRoute.Sitemap = [];
  for (const cat of CATEGORIES) {
    for (const city of FRENCH_CITIES) {
      cityPages.push({
        url: `${BASE}/annonces/${cat.id}/${city.slug}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.75,
      });
    }
  }

  const longTailPages: MetadataRoute.Sitemap = [];
  for (const cat of CATEGORIES) {
    if (!PRIORITY_CATEGORIES.includes(cat.id)) continue;
    for (const sub of cat.subcategories) {
      for (const city of PRIORITY_LONGTAIL_CITIES) {
        longTailPages.push({
          url: `${BASE}/annonces/${cat.id}/${subcategoryToSlug(sub)}/${city.slug}`,
          lastModified: now,
          changeFrequency: "daily" as const,
          priority: 0.7,
        });
      }
    }
  }

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
    // fail silently
  }

  let extraLocations: MetadataRoute.Sitemap = [];
  try {
    const knownSlugs = new Set(FRENCH_CITIES.map((c) => c.slug));
    const rows = await prisma.listing.findMany({
      where: { status: "APPROVED", deletedAt: null } as any,
      select: { category: true, location: true },
      distinct: ["category", "location"],
    });
    for (const row of rows) {
      const cat = CATEGORIES.find((c) => c.label === row.category);
      if (!cat || !row.location) continue;
      const slug = citySlug(row.location);
      if (!slug || knownSlugs.has(slug)) continue;
      extraLocations.push({
        url: `${BASE}/annonces/${cat.id}/${slug}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.65,
      });
    }
  } catch {
    // fail silently
  }

  return [...statics, ...categories, ...cityPages, ...longTailPages, ...extraLocations, ...listings];
}

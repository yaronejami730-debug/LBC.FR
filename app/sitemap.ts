import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";

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

  // Category pages
  const categories: MetadataRoute.Sitemap = CATEGORIES.map((cat) => ({
    url: `${BASE}/search?category=${encodeURIComponent(cat.label)}`,
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
      url: `${BASE}/listing/${l.id}`,
      lastModified: l.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // fail silently — sitemap still works without listings
  }

  return [...statics, ...categories, ...listings];
}

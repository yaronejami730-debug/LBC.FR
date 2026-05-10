import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { FRENCH_CITIES, TOP_CITIES, citySlug } from "@/lib/cities";
import { subcategoryToSlug } from "@/lib/seo-content";
import { getAllArticles } from "@/lib/blog";
import { listingSlug } from "@/lib/listing-slug";
import { CAR_BRANDS } from "@/lib/carBrands";

const BASE = "https://www.dealandcompany.fr";
const PRIORITY_CATEGORIES = ["vehicules", "immobilier", "multimedia", "mode", "maison"];
const PRIORITY_LONGTAIL_CITIES = TOP_CITIES.slice(0, 15);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const statics: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/a-propos`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/nouveautes`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/mentions-legales`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/cgu`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/confidentialite`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/api-doc`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  const blogPosts: MetadataRoute.Sitemap = getAllArticles().map((a) => ({
    url: `${BASE}/blog/${a.slug}`,
    lastModified: new Date(a.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  function marqueToSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  const brandPages: MetadataRoute.Sitemap = CAR_BRANDS.map((b) => ({
    url: `${BASE}/annonces/vehicules/${marqueToSlug(b.name)}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const POPULAR_MODELS = [
    "renault-clio-occasion", "peugeot-208-occasion", "citroen-c3-occasion",
    "volkswagen-golf-occasion", "renault-megane-occasion", "peugeot-308-occasion",
    "dacia-sandero-occasion", "toyota-yaris-occasion", "ford-fiesta-occasion",
    "bmw-serie-3-occasion", "mercedes-classe-a-occasion", "audi-a3-occasion",
    "renault-scenic-occasion", "opel-corsa-occasion", "nissan-qashqai-occasion",
    "iphone-14-occasion", "iphone-13-occasion", "samsung-galaxy-s23-occasion",
    "canape-ikea-occasion", "table-occasion", "velo-occasion",
  ];

  const prixPages: MetadataRoute.Sitemap = POPULAR_MODELS.map((slug) => ({
    url: `${BASE}/prix/${slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // Aggregate listing counts so we only include pages that have real content.
  // Pages with 0 listings are excluded — they look like doorway/thin pages to Google
  // and waste crawl budget, which is what causes "Discovered, currently not indexed".
  let countsByCatLocation = new Map<string, number>();
  let countsByCatSubLocation = new Map<string, number>();
  let countsByCategory = new Map<string, number>();

  try {
    const grouped = await prisma.listing.groupBy({
      by: ["category", "subcategory", "location"],
      where: { status: "APPROVED", shadowBanned: false, deletedAt: null } as any,
      _count: { _all: true },
    });

    for (const row of grouped) {
      const count = row._count._all;
      const cat = CATEGORIES.find((c) => c.label === row.category);
      if (!cat) continue;

      countsByCategory.set(cat.id, (countsByCategory.get(cat.id) ?? 0) + count);

      if (!row.location) continue;
      const slug = citySlug(row.location);
      if (!slug) continue;

      const catCityKey = `${cat.id}:${slug}`;
      countsByCatLocation.set(catCityKey, (countsByCatLocation.get(catCityKey) ?? 0) + count);

      if (row.subcategory) {
        const subSlug = subcategoryToSlug(row.subcategory);
        const key = `${cat.id}:${subSlug}:${slug}`;
        countsByCatSubLocation.set(key, (countsByCatSubLocation.get(key) ?? 0) + count);
      }
    }
  } catch {
    // fail silently; we will still emit static + listing URLs
  }

  // Category landing pages: only include categories that have any listings.
  const categories: MetadataRoute.Sitemap = CATEGORIES
    .filter((cat) => (countsByCategory.get(cat.id) ?? 0) > 0)
    .map((cat) => ({
      url: `${BASE}/annonces/${cat.id}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

  // Category × city pages: only include combos with at least one listing.
  const cityPages: MetadataRoute.Sitemap = [];
  for (const cat of CATEGORIES) {
    for (const city of FRENCH_CITIES) {
      const key = `${cat.id}:${city.slug}`;
      if ((countsByCatLocation.get(key) ?? 0) === 0) continue;
      cityPages.push({
        url: `${BASE}/annonces/${cat.id}/${city.slug}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.75,
      });
    }
  }

  // Long-tail subcategory × city pages: only include combos with at least one listing.
  const longTailPages: MetadataRoute.Sitemap = [];
  for (const cat of CATEGORIES) {
    if (!PRIORITY_CATEGORIES.includes(cat.id)) continue;
    for (const sub of cat.subcategories) {
      const subSlug = subcategoryToSlug(sub);
      for (const city of PRIORITY_LONGTAIL_CITIES) {
        const key = `${cat.id}:${subSlug}:${city.slug}`;
        if ((countsByCatSubLocation.get(key) ?? 0) === 0) continue;
        longTailPages.push({
          url: `${BASE}/annonces/${cat.id}/${subSlug}/${city.slug}`,
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
      where: { status: "APPROVED", shadowBanned: false, deletedAt: null } as any,
      select: { id: true, title: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    listings = rows.map((l) => ({
      url: `${BASE}/annonce/${l.id}/${listingSlug(l.title)}`,
      lastModified: l.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // fail silently
  }

  return [...statics, ...blogPosts, ...brandPages, ...prixPages, ...categories, ...cityPages, ...longTailPages, ...listings];
}

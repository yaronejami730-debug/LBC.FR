import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { FRENCH_CITIES, TOP_CITIES, citySlug } from "@/lib/cities";
import { subcategoryToSlug } from "@/lib/seo-content";
import { getAllArticles } from "@/lib/blog";
import { listingSlug } from "@/lib/listing-slug";
import { CAR_BRANDS } from "@/lib/carBrands";

const getGroupedCounts = unstable_cache(
  async () =>
    prisma.listing
      .groupBy({
        by: ["category", "subcategory", "location"],
        where: { status: "APPROVED", shadowBanned: false, deletedAt: null } as any,
        _count: { _all: true },
      })
      .catch(() => [] as any[]),
  ["sitemap-grouped-counts"],
  { revalidate: 1800, tags: ["listings"] },
);

const getVehicleBrandModelMeta = unstable_cache(
  async () =>
    prisma.listing
      .findMany({
        where: {
          status: "APPROVED",
          shadowBanned: false,
          deletedAt: null,
          category: "Véhicules",
        } as any,
        select: { metadata: true },
        take: 5000,
      })
      .catch(() => [] as { metadata: string }[]),
  ["sitemap-vehicle-meta"],
  { revalidate: 3600, tags: ["listings"] },
);

const getListingsTotal = unstable_cache(
  async () =>
    prisma.listing
      .count({
        where: { status: "APPROVED", shadowBanned: false, deletedAt: null } as any,
      })
      .catch(() => 0),
  ["sitemap-listings-total"],
  { revalidate: 1800, tags: ["listings"] },
);

const BASE = "https://www.dealandcompany.fr";
const PRIORITY_CATEGORIES = ["vehicules", "immobilier", "multimedia", "mode", "maison"];
const PRIORITY_LONGTAIL_CITIES = TOP_CITIES.slice(0, 15);

// Sitemap protocol limit is 50k URLs per file. We chunk listings at 20k for headroom
// and faster regeneration; everything else lives in dedicated segments.
const LISTINGS_PER_CHUNK = 20000;
const MAX_LISTING_CHUNKS = 5; // hard ceiling — 100k listings before we'd need to bump

export async function generateSitemaps() {
  const total = await getListingsTotal();
  const chunks = Math.min(
    MAX_LISTING_CHUNKS,
    Math.max(1, Math.ceil(total / LISTINGS_PER_CHUNK)),
  );
  const listingIds = Array.from({ length: chunks }, (_, i) => ({ id: `listings-${i}` }));
  return [
    { id: "main" },
    { id: "categories" },
    { id: "cities" },
    { id: "longtail" },
    { id: "brands" },
    { id: "prix" },
    { id: "blog" },
    ...listingIds,
  ];
}

export default async function sitemap({
  id,
}: {
  id: string;
}): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  if (id === "main") {
    return [
      { url: BASE, lastModified: now, changeFrequency: "daily", priority: 1 },
      { url: `${BASE}/a-propos`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
      { url: `${BASE}/nouveautes`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
      { url: `${BASE}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
      { url: `${BASE}/mentions-legales`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
      { url: `${BASE}/cgu`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
      { url: `${BASE}/confidentialite`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
      { url: `${BASE}/api-doc`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    ];
  }

  if (id === "blog") {
    return getAllArticles().map((a) => ({
      url: `${BASE}/blog/${a.slug}`,
      lastModified: new Date(a.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  }

  if (id === "brands") {
    function marqueToSlug(name: string) {
      return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    const out: MetadataRoute.Sitemap = CAR_BRANDS.map((b) => ({
      url: `${BASE}/annonces/vehicules/${marqueToSlug(b.name)}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

    // Discover brand+model combos that have listings — only those get indexed
    try {
      const rows = await getVehicleBrandModelMeta();
      const combos = new Map<string, number>();
      for (const r of rows) {
        try {
          const m = JSON.parse(r.metadata) as { marque?: string; modele?: string };
          if (!m.marque || !m.modele) continue;
          const marqueS = m.marque.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          const modeleS = m.modele.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          if (!marqueS || !modeleS) continue;
          const key = `${marqueS}/${modeleS}`;
          combos.set(key, (combos.get(key) ?? 0) + 1);
        } catch {}
      }
      for (const [combo, count] of combos.entries()) {
        if (count < 1) continue;
        out.push({
          url: `${BASE}/annonces/vehicules/${combo}`,
          lastModified: now,
          changeFrequency: "daily",
          priority: 0.7,
        });
      }
    } catch {}

    return out;
  }

  if (id === "prix") {
    const POPULAR_MODELS = [
      "renault-clio-occasion", "peugeot-208-occasion", "citroen-c3-occasion",
      "volkswagen-golf-occasion", "renault-megane-occasion", "peugeot-308-occasion",
      "dacia-sandero-occasion", "toyota-yaris-occasion", "ford-fiesta-occasion",
      "bmw-serie-3-occasion", "mercedes-classe-a-occasion", "audi-a3-occasion",
      "renault-scenic-occasion", "opel-corsa-occasion", "nissan-qashqai-occasion",
      "iphone-14-occasion", "iphone-13-occasion", "samsung-galaxy-s23-occasion",
      "canape-ikea-occasion", "table-occasion", "velo-occasion",
    ];
    return POPULAR_MODELS.map((slug) => ({
      url: `${BASE}/prix/${slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));
  }

  // For categories/cities/longtail we need the grouped counts to gate empty combos.
  let countsByCatLocation = new Map<string, number>();
  let countsByCatSubLocation = new Map<string, number>();
  let countsByCategory = new Map<string, number>();
  let countsByCity = new Map<string, number>();
  let countsByCatSub = new Map<string, number>();

  if (id === "categories" || id === "cities" || id === "longtail") {
    try {
      const grouped = await getGroupedCounts();

      for (const row of grouped) {
        const count = row._count._all;
        const cat = CATEGORIES.find((c) => c.label === row.category);
        if (!cat) continue;

        countsByCategory.set(cat.id, (countsByCategory.get(cat.id) ?? 0) + count);

        if (row.subcategory) {
          const subSlug = subcategoryToSlug(row.subcategory);
          const catSubKey = `${cat.id}:${subSlug}`;
          countsByCatSub.set(catSubKey, (countsByCatSub.get(catSubKey) ?? 0) + count);
        }

        if (!row.location) continue;
        const slug = citySlug(row.location);
        if (!slug) continue;

        countsByCity.set(slug, (countsByCity.get(slug) ?? 0) + count);

        const catCityKey = `${cat.id}:${slug}`;
        countsByCatLocation.set(catCityKey, (countsByCatLocation.get(catCityKey) ?? 0) + count);

        if (row.subcategory) {
          const subSlug = subcategoryToSlug(row.subcategory);
          const key = `${cat.id}:${subSlug}:${slug}`;
          countsByCatSubLocation.set(key, (countsByCatSubLocation.get(key) ?? 0) + count);
        }
      }
    } catch {
      // fail silently
    }
  }

  if (id === "categories") {
    const out: MetadataRoute.Sitemap = [];
    for (const cat of CATEGORIES) {
      if ((countsByCategory.get(cat.id) ?? 0) === 0) continue;
      out.push({
        url: `${BASE}/annonces/${cat.id}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
    return out;
  }

  if (id === "cities") {
    const out: MetadataRoute.Sitemap = [];
    // Standalone city landing pages
    for (const [slug, count] of countsByCity.entries()) {
      if (count === 0) continue;
      out.push({
        url: `${BASE}/ville/${slug}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.75,
      });
    }
    // Category × city pages
    for (const cat of CATEGORIES) {
      for (const city of FRENCH_CITIES) {
        const key = `${cat.id}:${city.slug}`;
        if ((countsByCatLocation.get(key) ?? 0) === 0) continue;
        out.push({
          url: `${BASE}/annonces/${cat.id}/${city.slug}`,
          lastModified: now,
          changeFrequency: "daily",
          priority: 0.75,
        });
      }
    }
    return out;
  }

  if (id === "longtail") {
    const out: MetadataRoute.Sitemap = [];
    // Sub-only landing pages (cat × sub, France-wide)
    for (const cat of CATEGORIES) {
      for (const sub of cat.subcategories) {
        const subSlug = subcategoryToSlug(sub);
        const key = `${cat.id}:${subSlug}`;
        if ((countsByCatSub.get(key) ?? 0) === 0) continue;
        out.push({
          url: `${BASE}/annonces/${cat.id}/${subSlug}`,
          lastModified: now,
          changeFrequency: "daily",
          priority: 0.75,
        });
      }
    }
    // Sub × city long-tail
    for (const cat of CATEGORIES) {
      if (!PRIORITY_CATEGORIES.includes(cat.id)) continue;
      for (const sub of cat.subcategories) {
        const subSlug = subcategoryToSlug(sub);
        for (const city of PRIORITY_LONGTAIL_CITIES) {
          const key = `${cat.id}:${subSlug}:${city.slug}`;
          if ((countsByCatSubLocation.get(key) ?? 0) === 0) continue;
          out.push({
            url: `${BASE}/annonces/${cat.id}/${subSlug}/${city.slug}`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.7,
          });
        }
      }
    }
    return out;
  }

  if (id.startsWith("listings-")) {
    const chunk = parseInt(id.replace("listings-", ""), 10) || 0;
    try {
      const rows = await prisma.listing.findMany({
        where: { status: "APPROVED", shadowBanned: false, deletedAt: null } as any,
        select: { id: true, title: true, updatedAt: true },
        orderBy: { createdAt: "desc" },
        skip: chunk * LISTINGS_PER_CHUNK,
        take: LISTINGS_PER_CHUNK,
      });
      return rows.map((l) => ({
        url: `${BASE}/annonce/${l.id}/${listingSlug(l.title)}`,
        lastModified: l.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
    } catch {
      return [];
    }
  }

  return [];
}

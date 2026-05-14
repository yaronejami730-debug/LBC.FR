import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

const BASE = "https://www.dealandcompany.fr";

// Mirrors the chunking logic in app/sitemap.ts. Keep in sync.
const LISTINGS_PER_CHUNK = 20000;
const MAX_LISTING_CHUNKS = 5;

const STATIC_SEGMENTS = [
  "main",
  "categories",
  "cities",
  "longtail",
  "brands",
  "prix",
  "voiture",
  "comparatif",
  "voiture-budget",
  "blog",
];

const getListingsTotal = unstable_cache(
  async () =>
    prisma.listing
      .count({
        where: { status: "APPROVED", shadowBanned: false, deletedAt: null } as any,
      })
      .catch(() => 0),
  ["sitemap-index-listings-total"],
  { revalidate: 1800, tags: ["listings"] },
);

const getGlobalLastMod = unstable_cache(
  async () =>
    prisma.listing
      .aggregate({
        where: { status: "APPROVED", shadowBanned: false, deletedAt: null } as any,
        _max: { updatedAt: true },
      })
      .then((r) => r._max.updatedAt)
      .catch(() => null),
  ["sitemap-index-global-lastmod"],
  { revalidate: 1800, tags: ["listings"] },
);

export async function GET() {
  const [total, maxUpdatedAt] = await Promise.all([
    getListingsTotal(),
    getGlobalLastMod(),
  ]);
  const chunks = Math.min(
    MAX_LISTING_CHUNKS,
    Math.max(1, Math.ceil(total / LISTINGS_PER_CHUNK)),
  );
  const listingIds = Array.from({ length: chunks }, (_, i) => `listings-${i}`);
  const allIds = [...STATIC_SEGMENTS, ...listingIds];
  const lastModified = (maxUpdatedAt ?? new Date()).toISOString();

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    allIds
      .map(
        (id) =>
          `  <sitemap><loc>${BASE}/sitemap/${id}.xml</loc><lastmod>${lastModified}</lastmod></sitemap>`,
      )
      .join("\n") +
    `\n</sitemapindex>\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=1800",
    },
  });
}

export const revalidate = 1800;

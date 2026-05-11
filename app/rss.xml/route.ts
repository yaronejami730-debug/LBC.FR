import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listingSlug } from "@/lib/listing-slug";

const BASE = "https://www.dealandcompany.fr";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const revalidate = 1800;

function mimeFromUrl(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "avif") return "image/avif";
  return "image/jpeg";
}

export async function GET() {
  const listings = await prisma.listing.findMany({
    where: {
      status: "APPROVED",
      deletedAt: null,
      shadowBanned: false,
      qualityScore: { gte: 40 },
      reportCount: { lt: 3 },
    } as any,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      category: true,
      location: true,
      images: true,
      createdAt: true,
    },
  });

  const items = listings.map((l) => {
    let imgs: string[] = [];
    try { imgs = JSON.parse(l.images); } catch { /* empty */ }
    const url = `${BASE}/annonce/${l.id}/${listingSlug(l.title)}`;
    const desc = `${l.price.toLocaleString("fr-FR")} € — ${l.location}. ${l.description.slice(0, 300)}`;
    const firstImg = typeof imgs[0] === "string" ? imgs[0] : null;
    return `  <item>
    <title>${esc(l.title)}</title>
    <link>${url}</link>
    <guid isPermaLink="true">${url}</guid>
    <description>${esc(desc)}</description>
    <category>${esc(l.category)}</category>
    <pubDate>${l.createdAt.toUTCString()}</pubDate>${firstImg ? `\n    <enclosure url="${esc(firstImg)}" type="${mimeFromUrl(firstImg)}" length="0"/>` : ""}
  </item>`;
  }).join("\n");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Deal&amp;Co — Dernières annonces</title>
    <link>${BASE}</link>
    <description>Les 100 dernières petites annonces entre particuliers sur dealandcompany.fr</description>
    <language>fr</language>
    <atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new NextResponse(feed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}

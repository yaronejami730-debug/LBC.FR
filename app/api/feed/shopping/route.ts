import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listingSlug } from "@/lib/listing-slug";

const BASE = "https://www.dealandcompany.fr";

// Categories with no physical product to sell
const EXCLUDED_CATEGORIES = [
  "immobilier",
  "vehicules",
  "services",
  "emploi",
  "communaute",
  "vacances",
];

// Google Product Category taxonomy IDs (fr)
const CATEGORY_GPC: Record<string, string> = {
  maison: "436",         // Furniture
  multimedia: "222",     // Electronics
  mode: "166",           // Fashion Accessories
  loisirs: "499",        // Sporting Goods
  animaux: "1",          // Pet Supplies
  "bebe-enfant": "537",  // Baby & Toddler
  "materiel-pro": "111", // Business & Industrial
  divers: "632",         // Arts & Entertainment
};

// Subcategory overrides for more precise matching
const SUBCATEGORY_GPC: Record<string, string> = {
  "Téléphonie": "267",
  "Informatique": "328",
  "Consoles & jeux vidéo": "1371",
  "Image & son": "404",
  "Vêtements": "1604",
  "Chaussures": "187",
  "Montres & bijoux": "188",
  "Accessoires & bagagerie": "166",
  "Électroménager": "730",
  "Ameublement": "436",
  "Livres": "784",
  "Musique / Instruments": "86",
  "Jeux & jouets": "1249",
  "Jeux & jouets enfant": "1249",
  "Vêtements enfant": "1604",
  "Puériculture": "537",
  "Mobilier enfant": "436",
  "Vélos": "3276",
  "Sports & hobbies": "499",
};

function mapCondition(condition: string): "new" | "used" {
  return /^neuf/i.test(condition) ? "new" : "used";
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const revalidate = 3600;

export async function GET() {
  const now = new Date();

  const listings = await prisma.listing.findMany({
    where: {
      status: "APPROVED",
      deletedAt: null,
      price: { gt: 0 },
      category: { notIn: EXCLUDED_CATEGORIES },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      category: true,
      subcategory: true,
      condition: true,
      brand: true,
      images: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 5000,
  });

  const items = listings
    .flatMap((l) => {
      let images: string[] = [];
      try { images = JSON.parse(l.images); } catch { /* empty */ }
      if (!images.length) return [];

      const url = `${BASE}/annonce/${l.id}/${listingSlug(l.title)}`;
      const gpc =
        (l.subcategory ? SUBCATEGORY_GPC[l.subcategory] : undefined) ??
        CATEGORY_GPC[l.category] ??
        "632";
      const condition = mapCondition(l.condition);
      const desc = esc(l.description.slice(0, 5000).replace(/\s+/g, " "));

      const additionalImages = images
        .slice(1, 10)
        .map((img) => `      <g:additional_image_link>${esc(img)}</g:additional_image_link>`)
        .join("\n");

      return [`    <item>
      <g:id>${esc(l.id)}</g:id>
      <g:title>${esc(l.title.slice(0, 150))}</g:title>
      <g:description>${desc}</g:description>
      <g:link>${esc(url)}</g:link>
      <g:image_link>${esc(images[0])}</g:image_link>
${additionalImages ? additionalImages + "\n" : ""}      <g:price>${l.price.toFixed(2)} EUR</g:price>
      <g:condition>${condition}</g:condition>
      <g:availability>in_stock</g:availability>
      <g:identifier_exists>no</g:identifier_exists>
      <g:google_product_category>${gpc}</g:google_product_category>
      <g:custom_label_0>${esc(l.category)}</g:custom_label_0>${l.subcategory ? `\n      <g:product_type>${esc(l.subcategory)}</g:product_type>` : ""}${l.brand ? `\n      <g:brand>${esc(l.brand)}</g:brand>` : ""}
    </item>`];
    })
    .join("\n");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Deal&amp;Co – Petites annonces entre particuliers</title>
    <link>${BASE}</link>
    <description>Achetez et vendez entre particuliers en France sur Deal&amp;Co</description>
${items}
  </channel>
</rss>`;

  return new NextResponse(feed, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

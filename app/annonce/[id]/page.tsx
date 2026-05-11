import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listingSlug } from "@/lib/listing-slug";
import type { Metadata } from "next";

const BASE = "https://www.dealandcompany.fr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { title: true, description: true, images: true, price: true, location: true },
  }).catch(() => null);

  if (!listing) return {};

  const imgs = JSON.parse(listing.images) as string[];
  const rawImg = imgs[0] ?? "";
  const mainImg = rawImg.startsWith("http") ? rawImg : `${BASE}${rawImg}`;
  const priceStr = listing.price.toLocaleString("fr-FR") + " €";
  const pageUrl = `${BASE}/annonce/${id}/${listingSlug(listing.title)}`;
  const desc = `${listing.description.slice(0, 150)}${listing.description.length > 150 ? "…" : ""} · ${listing.location} · ${priceStr}`;
  const ogImage = `${BASE}/annonce/${id}/opengraph-image`;

  return {
    title: `${listing.title} — ${priceStr}`,
    description: desc,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: `${listing.title} — ${priceStr}`,
      description: desc,
      url: pageUrl,
      siteName: "Deal&Co",
      type: "website",
      images: [
        { url: ogImage, width: 1200, height: 630, alt: listing.title },
        ...(mainImg ? [{ url: mainImg, alt: listing.title }] : []),
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${listing.title} — ${priceStr}`,
      description: desc,
      images: [ogImage],
    },
  };
}

export default async function ListingRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { title: true },
  }).catch(() => null);
  if (!listing) notFound();
  permanentRedirect(`/annonce/${id}/${listingSlug(listing.title)}`);
}

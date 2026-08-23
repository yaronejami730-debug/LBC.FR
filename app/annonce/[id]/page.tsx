import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listingSlug } from "@/lib/listing-slug";
import { buildListingMeta } from "@/lib/seo/listing-meta";
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
    select: {
      title: true,
      description: true,
      images: true,
      price: true,
      location: true,
      category: true,
      subcategory: true,
    },
  }).catch(() => null);

  if (!listing) return {};

  const imgs = JSON.parse(listing.images) as string[];
  const rawImg = imgs[0] ?? "";
  const mainImg = rawImg.startsWith("http") ? rawImg : `${BASE}${rawImg}`;
  const pageUrl = `${BASE}/annonce/${id}/${listingSlug(listing.title)}`;
  const ogImage = `${BASE}/annonce/${id}/opengraph-image`;

  /**
   * Même constructeur que la page avec slug.
   *
   * Cette route ne fait que rediriger — mais un partage sur une messagerie ou
   * un réseau social lit la metadata **avant** de suivre la redirection, et
   * cette version-ci affichait un format différent : sans ville, sans suffixe
   * de marque, et « 0 € » quand le prix n'était pas donné.
   */
  const meta = buildListingMeta({
    title: listing.title,
    description: listing.description,
    location: listing.location,
    price: listing.price,
    category: listing.category,
    subcategory: listing.subcategory,
  });
  const desc = meta.description;

  return {
    title: meta.title,
    description: desc,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: meta.titleWithBrand,
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
      title: meta.titleWithBrand,
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

import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listingSlug } from "@/lib/listing-slug";

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

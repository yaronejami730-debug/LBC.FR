import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import EditForm from "./EditForm";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/listing/${id}/edit`);

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) notFound();
  if (listing.userId !== session.user.id) notFound();

  const images = JSON.parse(listing.images) as string[];
  let metadata: Record<string, string> = {};
  try { metadata = JSON.parse(listing.metadata); } catch { /* ignore */ }

  return (
    <EditForm
      listingId={id}
      initial={{
        title: listing.title,
        price: String(listing.price),
        description: listing.description,
        location: listing.location,
        condition: listing.condition,
        category: listing.category,
        subcategory: listing.subcategory ?? "",
        images,
        metadata,
      }}
    />
  );
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { broadcastViewUpdate } from "@/lib/listing-views";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [listing, session] = await Promise.all([
    prisma.listing.findUnique({
      where: { id },
      select: { userId: true, viewCount: true, deletedAt: true, status: true },
    }),
    auth(),
  ]);

  if (!listing || listing.deletedAt) {
    return new Response("Not found", { status: 404 });
  }

  // Don't count the owner's own views
  if (session?.user?.id === listing.userId) {
    return Response.json({ viewCount: listing.viewCount });
  }

  const updated = await prisma.listing.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
    select: { viewCount: true },
  });

  broadcastViewUpdate(listing.userId, id, updated.viewCount);

  return Response.json({ viewCount: updated.viewCount });
}

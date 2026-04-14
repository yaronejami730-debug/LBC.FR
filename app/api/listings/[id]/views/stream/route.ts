import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subscribeListingViews } from "@/lib/listing-views";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { userId: true, viewCount: true },
  });

  if (!listing || listing.userId !== session.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send current count immediately
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ viewCount: listing.viewCount })}\n\n`
        )
      );

      const unsubscribe = subscribeListingViews(id, (_listingId, viewCount) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ viewCount })}\n\n`)
          );
        } catch {
          unsubscribe();
        }
      });

      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(ping);
        }
      }, 25_000);

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(ping);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

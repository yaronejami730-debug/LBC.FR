import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subscribeUserViews } from "@/lib/listing-views";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const userId = session.user.id;

  const listings = await prisma.listing.findMany({
    where: { userId, deletedAt: null },
    select: { id: true, viewCount: true },
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial state for all listings
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "init", listings })}\n\n`
        )
      );

      const unsubscribe = subscribeUserViews(userId, (listingId, viewCount) => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "update", listingId, viewCount })}\n\n`
            )
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

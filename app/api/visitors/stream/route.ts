import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getVisitorCount, subscribeAdmin } from "@/lib/visitors";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || role !== "ADMIN") {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send current count immediately
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ count: getVisitorCount() })}\n\n`)
      );

      const unsubscribe = subscribeAdmin((count) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ count })}\n\n`)
          );
        } catch {
          unsubscribe();
        }
      });

      // Keep-alive every 25s
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

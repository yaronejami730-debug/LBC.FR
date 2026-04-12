import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { subscribe } from "@/lib/sse";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { conversationId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send a keep-alive comment immediately
      controller.enqueue(encoder.encode(": connected\n\n"));

      const unsubscribe = subscribe(conversationId, (data) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      });

      // Keep-alive ping every 25s
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(ping);
        }
      }, 25000);

      // Cleanup on disconnect
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

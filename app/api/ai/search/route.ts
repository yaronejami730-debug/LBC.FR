import { NextResponse } from "next/server";
import { runAISearch, type AIMessage } from "@/lib/ai-search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Anti-abus minimaliste : 20 messages par IP toutes les 10 minutes.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 20;
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_MAX) return false;
  b.count++;
  return true;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans quelques minutes." },
      { status: 429 },
    );
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide" }, { status: 400 });
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages requis" }, { status: 400 });
  }

  const cleaned: AIMessage[] = [];
  for (const m of messages) {
    if (
      typeof m !== "object" ||
      m === null ||
      typeof (m as { content?: unknown }).content !== "string" ||
      ((m as { role?: unknown }).role !== "user" && (m as { role?: unknown }).role !== "assistant")
    ) {
      return NextResponse.json({ error: "format de message invalide" }, { status: 400 });
    }
    const content = String((m as { content: string }).content).slice(0, 2000);
    cleaned.push({ role: (m as { role: "user" | "assistant" }).role, content });
  }

  // Limite la conversation à 12 derniers tours pour borner les coûts.
  const trimmed = cleaned.slice(-12);

  try {
    const result = await runAISearch(trimmed);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[ai/search]", err);
    return NextResponse.json(
      { error: "Erreur lors de la recherche IA. Réessayez." },
      { status: 500 },
    );
  }
}

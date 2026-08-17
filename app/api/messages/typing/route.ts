import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Durée de vie d'un « écrit… ». Rafraîchie tant que la personne tape. */
const TYPING_WINDOW_MS = 6000;

/**
 * Signale que l'utilisateur est en train d'écrire.
 *
 * Une échéance est stockée plutôt qu'un booléen : un onglet fermé brutalement
 * ne laisse pas « écrit… » affiché pour l'éternité, l'indication s'éteint
 * d'elle-même six secondes plus tard.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = (await req.json().catch(() => ({}))) as { conversationId?: string };
  if (!conversationId) return NextResponse.json({ error: "conversationId requis" }, { status: 400 });

  const updated = await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { typingUntil: new Date(Date.now() + TYPING_WINDOW_MS) },
  });
  // Aucune ligne : l'appelant n'est pas dans cette conversation.
  if (updated.count === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ ok: true });
}

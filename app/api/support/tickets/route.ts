import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";
import { SupportError, openTicket } from "@/lib/support/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mes discussions avec le support.
 *
 * Une seule route pour le site et l'application : `getAuthUserId` accepte le
 * cookie de session comme le jeton mobile. Un utilisateur qui écrit depuis son
 * téléphone puis rouvre le site retrouve le même fil, au même endroit.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const tickets = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      lastMessageAt: true,
      unreadForUser: true,
      createdAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, fromSupport: true, createdAt: true },
      },
    },
  });

  return NextResponse.json({
    tickets: tickets.map((t) => ({
      ...t,
      lastMessage: t.messages[0] ?? null,
      messages: undefined,
    })),
  });
}

/** Ouvre une discussion — ou complète celle déjà ouverte sur le même sujet. */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ticket = await openTicket({
      userId,
      subject: String(body.subject ?? ""),
      message: String(body.message ?? ""),
      category: body.category ? String(body.category) : undefined,
      listingId: body.listingId ? String(body.listingId) : null,
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    if (error instanceof SupportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[support] ouverture", error);
    return NextResponse.json({ error: "Envoi impossible." }, { status: 500 });
  }
}

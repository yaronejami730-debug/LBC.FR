import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-unified";
import { SupportError, markRead, postMessage, setStatus } from "@/lib/support/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Un fil de support, vu par son propriétaire ou par un modérateur.
 *
 * Le même point d'entrée sert les deux : c'est la même conversation. Ce qui
 * change, c'est le côté — qui voit les messages comme lus, et qui parle au nom
 * de la plateforme. Le déduire du rôle plutôt que d'un paramètre évite qu'un
 * client puisse se faire passer pour le support.
 */
async function resolveAccess(req: NextRequest, ticketId: string) {
  const actor = await getAuthUser(req);
  if (!actor?.id) throw new SupportError("Authentification requise.", 401);

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, userId: true, status: true },
  });
  if (!ticket) throw new SupportError("Discussion introuvable.", 404);

  const account = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { role: true },
  });
  const isAdmin = account?.role === "ADMIN";
  const isOwner = ticket.userId === actor.id;
  if (!isAdmin && !isOwner) throw new SupportError("Discussion introuvable.", 404);

  return { actorId: actor.id, isAdmin, isOwner, ticket };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { isAdmin, isOwner } = await resolveAccess(req, id);

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true, isPro: true } },
        listing: { select: { id: true, title: true } },
        assignedTo: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { id: true, name: true, avatar: true } } },
        },
      },
    });

    // Ouvrir le fil vaut lecture : le compteur de l'autre partie retombe.
    // Un administrateur qui consulte sans être propriétaire lit côté support.
    await markRead(id, isAdmin && !isOwner ? "admin" : "user");

    return NextResponse.json({ ticket });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Ajoute un message au fil. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { actorId, isAdmin, isOwner } = await resolveAccess(req, id);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const message = await postMessage({
      ticketId: id,
      senderId: actorId,
      content: String(body.content ?? ""),
      // Un administrateur qui écrit dans son propre ticket reste un client.
      fromSupport: isAdmin && !isOwner,
      attachmentUrl: body.attachmentUrl ? String(body.attachmentUrl) : null,
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Change l'état du fil.
 *
 * Le client ne dispose que de « résolu » : il peut clore sa propre demande,
 * pas la classer sans suite ni la rouvrir de force — répondre suffit à la
 * rouvrir, et c'est plus honnête qu'un bouton.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { isAdmin, isOwner } = await resolveAccess(req, id);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const status = String(body.status ?? "");

    if (!isAdmin && !(isOwner && status === "RESOLVED")) {
      throw new SupportError("Action réservée au support.", 403);
    }

    const ticket = await setStatus(id, status as never);
    return NextResponse.json({ ticket });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof SupportError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[support] fil", error);
  return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
}

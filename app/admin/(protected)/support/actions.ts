"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-unified";
import { markRead, postMessage, setStatus, type SupportStatus } from "@/lib/support/tickets";

/**
 * Actions du support côté modération.
 *
 * Comme le reste de l'administration, elles renvoient leur échec au lieu de le
 * lever : en production, une exception dans une Server Action perd son message
 * et laisse l'opérateur devant un mur.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<string> {
  const actor = await getAuthUser();
  if (!actor?.id) throw new Error("Accès refusé");
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { role: true } });
  if (user?.role !== "ADMIN") throw new Error("Accès refusé");
  return actor.id;
}

async function guard(label: string, fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    console.error(`[admin/support] ${label}:`, err);
    return { ok: false, error: err instanceof Error ? err.message : "Erreur inconnue" };
  }
}

/** Répond au client. Le fil repasse « en attente du client ». */
export async function replyToTicket(
  ticketId: string,
  content: string,
  attachment?: { url: string; name: string; type: string } | null,
): Promise<ActionResult> {
  return guard("reply", async () => {
    const adminId = await requireAdmin();
    // Un document seul est une réponse : « voici l'attestation » n'a pas besoin
    // d'être écrit pour être utile.
    if (content.trim().length < 2 && !attachment) throw new Error("Message vide");
    await postMessage({
      ticketId,
      senderId: adminId,
      content,
      fromSupport: true,
      attachmentUrl: attachment?.url ?? null,
      attachmentType: attachment?.type ?? null,
      attachmentName: attachment?.name ?? null,
    });
    // Répondre, c'est avoir lu : sans cela, le client garde un simple accusé
    // d'envoi sur un message auquel on vient pourtant de répondre.
    await markRead(ticketId, "admin");
    revalidatePath("/admin/support");
  });
}

/** Change l'état du fil : à traiter, en attente, résolu, clos. */
export async function setTicketStatus(ticketId: string, status: string): Promise<ActionResult> {
  return guard("status", async () => {
    await requireAdmin();
    await setStatus(ticketId, status as SupportStatus);
    revalidatePath("/admin/support");
  });
}

/**
 * S'attribue le dossier, ou le relâche.
 *
 * Sans cela, deux modérateurs répondent en même temps et le client reçoit deux
 * réponses différentes à la même question.
 */
export async function assignTicket(ticketId: string, take: boolean): Promise<ActionResult> {
  return guard("assign", async () => {
    const adminId = await requireAdmin();
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedToId: take ? adminId : null },
    });
    revalidatePath("/admin/support");
  });
}

/** Change la priorité — LOW, NORMAL, HIGH. */
export async function setTicketPriority(ticketId: string, priority: string): Promise<ActionResult> {
  return guard("priority", async () => {
    await requireAdmin();
    if (!["LOW", "NORMAL", "HIGH"].includes(priority)) throw new Error("Priorité inconnue");
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { priority } });
    revalidatePath("/admin/support");
  });
}

/** Marque le fil comme lu côté support. */
export async function markTicketRead(ticketId: string): Promise<ActionResult> {
  return guard("read", async () => {
    await requireAdmin();
    await markRead(ticketId, "admin");
    revalidatePath("/admin/support");
  });
}

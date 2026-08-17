/**
 * Support client — la mécanique commune au site, à l'application et à
 * l'administration.
 *
 * Un principe tient tout le fichier : **le fil ne se perd jamais**. Un ticket
 * n'est pas supprimé quand il est résolu, il est refermé ; un message envoyé
 * pendant qu'un ticket est marqué résolu le rouvre au lieu de disparaître ; et
 * un utilisateur qui écrit trois fois de suite n'ouvre pas trois dossiers,
 * parce qu'un modérateur ne doit pas avoir à recoller la conversation.
 */
import { prisma } from "@/lib/prisma";
import { notifyAdmins } from "@/lib/expo-push";
import { sendPushNotification } from "@/lib/notifications/send";
import { sendEmail } from "@/lib/email";
import { baseEmail } from "@/lib/emails/base";

// Réexport : les libellés vivent dans un module sans dépendance serveur pour
// que l'interface puisse les afficher sans embarquer Prisma.
export {
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  type SupportStatus,
} from "@/lib/support/constants";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  type SupportStatus,
} from "@/lib/support/constants";

const MAX_SUBJECT = 140;
const MAX_MESSAGE = 4000;

export class SupportError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Ouvre un ticket, ou raccroche le message au dernier fil encore ouvert.
 *
 * Ouvrir un dossier par message donnerait au modérateur trois conversations
 * parallèles sur le même problème. Un ticket clos, en revanche, ne se rouvre
 * pas ainsi : un nouveau sujet mérite un nouveau fil.
 */
export async function openTicket(input: {
  userId: string;
  subject: string;
  message: string;
  category?: string;
  listingId?: string | null;
}) {
  const subject = input.subject.trim().slice(0, MAX_SUBJECT);
  const message = input.message.trim().slice(0, MAX_MESSAGE);
  if (subject.length < 3) throw new SupportError("Indiquez l'objet de votre demande.", 400);
  if (message.length < 10) throw new SupportError("Décrivez votre demande en quelques mots.", 400);

  const category = SUPPORT_CATEGORIES.some((c) => c.value === input.category)
    ? input.category!
    : "autre";

  // Anti-doublon : un fil déjà ouvert sur le même sujet reçoit le message.
  const existing = await prisma.supportTicket.findFirst({
    where: { userId: input.userId, subject, status: { in: ["OPEN", "WAITING_USER"] } },
    select: { id: true },
  });
  if (existing) {
    await postMessage({ ticketId: existing.id, senderId: input.userId, content: message });
    return prisma.supportTicket.findUnique({ where: { id: existing.id } });
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: input.userId,
      subject,
      category,
      listingId: input.listingId || null,
      status: "OPEN",
      lastMessageAt: new Date(),
      unreadForAdmin: 1,
      messages: { create: { senderId: input.userId, content: message, fromSupport: false } },
    },
  });

  await alertAdmins(ticket.id, subject, message, input.userId);
  return ticket;
}

/**
 * Ajoute un message à un fil.
 *
 * `fromSupport` décide de tout le reste : à qui appartient le compteur de non-lus,
 * qui reçoit la notification, et dans quel état repart le ticket. Une réponse du
 * support met la balle dans le camp du client ; un message du client remet le
 * dossier à traiter, même s'il avait été marqué résolu la veille.
 */
export async function postMessage(input: {
  ticketId: string;
  senderId: string;
  content: string;
  fromSupport?: boolean;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
}) {
  const content = input.content.trim().slice(0, MAX_MESSAGE);
  // Une pièce jointe seule est un message : « voici ma facture » n'a pas
  // besoin d'être écrit pour être compris.
  if (content.length < 1 && !input.attachmentUrl) throw new SupportError("Message vide.", 400);

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: input.ticketId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!ticket) throw new SupportError("Discussion introuvable.", 404);

  const fromSupport = Boolean(input.fromSupport);

  const message = await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: input.senderId,
      fromSupport,
      content,
      attachmentUrl: input.attachmentUrl || null,
      attachmentType: input.attachmentType || null,
      attachmentName: input.attachmentName || null,
    },
  });

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      lastMessageAt: new Date(),
      status: fromSupport ? "WAITING_USER" : "OPEN",
      closedAt: null,
      ...(fromSupport
        ? { unreadForUser: { increment: 1 } }
        : { unreadForAdmin: { increment: 1 } }),
    },
  });

  // Le corps de l'e-mail annonce la pièce jointe : sans cela, un message
  // réduit à « voici le document » paraît vide au destinataire.
  const notice = input.attachmentName
    ? `${content}${content ? "\n\n" : ""}📎 Pièce jointe : ${input.attachmentName}`
    : content;

  if (fromSupport) {
    await notifyUserOfReply(ticket.user, ticket.id, ticket.subject, notice);
  } else {
    await alertAdmins(ticket.id, ticket.subject, notice, input.senderId);
  }

  return message;
}

/** Marque comme lus les messages de l'autre partie, et remet son compteur à zéro. */
export async function markRead(ticketId: string, side: "user" | "admin") {
  await prisma.supportMessage.updateMany({
    where: { ticketId, readAt: null, fromSupport: side === "user" },
    data: { readAt: new Date() },
  });
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: side === "user" ? { unreadForUser: 0 } : { unreadForAdmin: 0 },
  });
}

/** Change l'état d'un ticket. Fermer n'efface rien : le fil reste lisible. */
export async function setStatus(ticketId: string, status: SupportStatus) {
  if (!(status in SUPPORT_STATUSES)) throw new SupportError("Statut inconnu.", 400);
  return prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status,
      closedAt: status === "CLOSED" || status === "RESOLVED" ? new Date() : null,
    },
  });
}

/**
 * Prévient les modérateurs qu'un message attend.
 *
 * Push vers les appareils en mode administrateur, et email de secours vers
 * l'adresse de l'équipe : un support qui dépend d'un seul canal finit par rater
 * la demande du samedi soir.
 */
async function alertAdmins(ticketId: string, subject: string, content: string, authorId: string) {
  notifyAdmins(
    {
      title: "Support — nouveau message",
      body: `${subject} : ${content.slice(0, 120)}`,
      data: { type: "admin_support", ticketId },
    },
    { exceptUserId: authorId },
  ).catch(() => {});

  const to = process.env.ADMIN_EMAIL;
  if (!to) return;
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
  sendEmail({
    to,
    subject: `Support : ${subject}`,
    html: baseEmail({
      title: "Nouveau message au support",
      heading: "Nouveau message au support",
      body: `<p><strong>${escapeHtml(subject)}</strong></p><p>${escapeHtml(content.slice(0, 500))}</p>`,
      ctaLabel: "Ouvrir la discussion",
      ctaUrl: `${baseUrl}/admin/support?ticket=${ticketId}`,
    }),
  }).catch(() => {});
}

/** Prévient le client qu'on lui a répondu — notification, puis email. */
async function notifyUserOfReply(
  user: { id: string; email: string; name: string | null },
  ticketId: string,
  subject: string,
  content: string,
) {
  sendPushNotification({
    userId: user.id,
    template: "support_reply",
    variables: { message: content.slice(0, 140), ticketId },
  }).catch(() => {});

  if (!user.email) return;
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
  sendEmail({
    to: user.email,
    toName: user.name ?? "",
    subject: `Réponse du support — ${subject}`,
    html: baseEmail({
      title: "Le support vous a répondu",
      heading: "Le support vous a répondu",
      body: `<p>${escapeHtml(content.slice(0, 800))}</p>`,
      ctaLabel: "Répondre",
      ctaUrl: `${baseUrl}/support/${ticketId}`,
    }),
    userId: user.id,
  }).catch(() => {});
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

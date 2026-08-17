import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import ConversationList from "./ConversationList";
import SupportEntry from "./SupportEntry";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Messages — Deal&Co",
  robots: { index: false, follow: false },
};

export default async function MessagesPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  /**
   * Le support est une conversation comme une autre.
   *
   * Il vivait derrière un onglet du profil, là où personne ne va quand il a un
   * problème : on cherche ses messages. Il apparaît donc ici, en tête, avec
   * son compteur de non-lus — et il reste accessible depuis le profil pour qui
   * a pris l'habitude.
   */
  const ticket = await prisma.supportTicket
    .findFirst({
      where: { userId, status: { notIn: ["CLOSED"] } },
      orderBy: { lastMessageAt: "desc" },
      select: {
        id: true,
        subject: true,
        unreadForUser: true,
        lastMessageAt: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, fromSupport: true, attachmentName: true },
        },
      },
    })
    .catch(() => null);

  return (
    <div className="bg-[#fbfcff] text-on-surface min-h-screen pb-24">
      <Navbar active="messages" />

      {/* Main Content Canvas */}
      <main className="pt-32 px-4 max-w-2xl mx-auto">
        {/* Editorial Header */}
        <div className="mb-8 px-2 flex items-end justify-between">
          <div>
            <span className="text-primary font-bold uppercase tracking-[0.15em] text-[10px] mb-1 block">Votre centre de</span>
            <h2 className="text-4xl font-black text-[#2f6fb8] tracking-tighter">Messages</h2>
          </div>
          <div className="hidden md:block">
            <p className="text-slate-400 text-sm font-medium">Gestion des conversations directes</p>
          </div>
        </div>

        <SupportEntry
          ticket={
            ticket
              ? {
                  id: ticket.id,
                  subject: ticket.subject,
                  unread: ticket.unreadForUser,
                  lastMessageAt: ticket.lastMessageAt.toISOString(),
                  preview:
                    ticket.messages[0]?.content ||
                    (ticket.messages[0]?.attachmentName ? "Pièce jointe" : ""),
                  fromSupport: ticket.messages[0]?.fromSupport ?? false,
                }
              : null
          }
        />

        {/* Chat List — real-time client component */}
        <ConversationList currentUserId={userId} />
      </main>
    </div>
  );
}

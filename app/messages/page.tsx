import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";

export default async function MessagesPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId } },
    },
    include: {
      listing: { select: { id: true, title: true, images: true } },
      participants: {
        include: { user: { select: { id: true, name: true, avatar: true, verified: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="bg-background text-on-surface min-h-screen pb-24">
      <Navbar active="messages" />

      {/* Main Content Canvas */}
      <main className="pt-24 px-4 max-w-2xl mx-auto">
        {/* Editorial Header */}
        <div className="mb-8 px-2">
          <h2 className="text-4xl font-extrabold text-primary tracking-tight mb-2">Messages</h2>
          <p className="text-secondary body-md">Conversations directes avec acheteurs et vendeurs.</p>
        </div>

        {/* Search Bar */}
        <div className="mb-8 px-2">
          <div className="bg-surface-container-lowest rounded-xl flex items-center px-4 py-3 shadow-[0_8px_16px_rgba(21,21,125,0.03)] border border-outline-variant/10">
            <span className="material-symbols-outlined text-outline mr-3">search</span>
            <input className="bg-transparent border-none focus:ring-0 w-full text-on-surface placeholder:text-outline/60 text-sm outline-none" placeholder="Rechercher des conversations..." type="text" />
          </div>
        </div>

        {/* Chat List */}
        <div className="space-y-4">
          {conversations.length === 0 ? (
            <div className="py-24 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-5xl block mb-4">chat_bubble</span>
              <p className="text-lg font-semibold">Aucune conversation</p>
              <p className="text-sm mt-1">Commencez par contacter un vendeur depuis une annonce</p>
              <Link href="/search" className="mt-6 inline-block px-8 py-3 bg-primary text-white rounded-full font-bold">Parcourir les annonces</Link>
            </div>
          ) : (
            conversations.map((conv) => {
              const otherParticipant = conv.participants.find(
                (p) => p.userId !== userId
              );
              const lastMessage = conv.messages[0];
              const unread = conv.messages.some((m) => !m.read && m.senderId !== userId);
              const listingImages = JSON.parse(conv.listing.images) as string[];

              return (
                <Link
                  key={conv.id}
                  href={`/messages/${conv.id}`}
                  className={`${unread ? "bg-surface-container-lowest" : "bg-surface-container-low"} rounded-xl p-4 flex items-center gap-4 group cursor-pointer hover:bg-surface-container-lowest transition-all duration-200`}
                >
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-surface-container flex items-center justify-center">
                      {otherParticipant?.user.avatar ? (
                        <img className="w-full h-full object-cover" alt={otherParticipant.user.name} src={otherParticipant.user.avatar} />
                      ) : (
                        <span className="material-symbols-outlined text-2xl text-outline">person</span>
                      )}
                    </div>
                    {unread && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-tertiary-fixed rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <div className="flex items-center gap-1">
                        <h3 className="font-bold text-on-surface truncate">{otherParticipant?.user.name || "Unknown"}</h3>
                        {otherParticipant?.user.verified && (
                          <span className="material-symbols-outlined text-tertiary-fixed-dim text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                        )}
                      </div>
                      <span className={`text-[10px] font-${unread ? "bold text-primary" : "medium text-outline"} uppercase tracking-wider`}>
                        {lastMessage ? formatDistanceToNow(lastMessage.createdAt) : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-semibold text-on-secondary-container bg-secondary-container/60 px-2 py-0.5 rounded-full truncate max-w-[180px]">{conv.listing.title}</span>
                    </div>
                    <p className={`text-sm ${unread ? "font-semibold text-on-surface" : "text-on-surface-variant"} truncate`}>
                      {lastMessage?.content || "No messages yet"}
                    </p>
                  </div>
                  {unread ? (
                    <div className="w-2.5 h-2.5 bg-primary rounded-full flex-shrink-0"></div>
                  ) : (
                    <span className="material-symbols-outlined text-outline/40 text-sm">done_all</span>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </main>

      <BottomNav active="messages" />
    </div>
  );
}

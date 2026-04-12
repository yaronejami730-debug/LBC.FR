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
    <div className="bg-[#fbfcff] text-on-surface min-h-screen pb-24">
      <Navbar active="messages" />

      {/* Main Content Canvas */}
      <main className="pt-32 px-4 max-w-2xl mx-auto">
        {/* Editorial Header */}
        <div className="mb-8 px-2 flex items-end justify-between">
          <div>
            <span className="text-primary font-bold uppercase tracking-[0.15em] text-[10px] mb-1 block">Votre centre de</span>
            <h2 className="text-4xl font-black text-[#15157d] tracking-tighter">Messages</h2>
          </div>
          <div className="hidden md:block">
            <p className="text-slate-400 text-sm font-medium">Gestion des conversations directes</p>
          </div>
        </div>

        {/* Chat List */}
        <div className="space-y-3">
          {conversations.length === 0 ? (
            <div className="py-24 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-4xl text-slate-300">chat_bubble</span>
              </div>
              <p className="text-xl font-bold text-[#15157d]">On se sent un peu seul ?</p>
              <p className="text-slate-500 text-sm mt-2 mb-8">Commencez par contacter un vendeur depuis une annonce.</p>
              <Link href="/search" className="px-8 py-3.5 bg-[#15157d] text-white rounded-full font-bold text-sm shadow-xl shadow-[#15157d]/20 active:scale-95 transition-transform">Explorer les annonces</Link>
            </div>
          ) : (
            conversations.map((conv) => {
              const otherParticipant = conv.participants.find(
                (p) => p.userId !== userId
              );
              const lastMessage = conv.messages[0];
              const unread = conv.messages.some((m) => !m.read && m.senderId !== userId);
              
              return (
                <Link
                  key={conv.id}
                  href={`/messages/${conv.id}`}
                  className={`group relative rounded-3xl p-4 flex items-center gap-4 border transition-all duration-300
                    ${unread 
                      ? "bg-white border-blue-100 shadow-[0_12px_24px_rgba(21,21,125,0.06)]" 
                      : "bg-[#f8f9fe]/50 border-transparent hover:bg-white hover:border-slate-100"}`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-white shadow-sm flex items-center justify-center ring-2 ring-[#f0f2f9]">
                      {otherParticipant?.user.avatar ? (
                        <img className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={otherParticipant.user.name} src={otherParticipant.user.avatar} />
                      ) : (
                        <span className="material-symbols-outlined text-2xl text-slate-300">person</span>
                      )}
                    </div>
                    {unread && (
                      <div className="absolute top-0 right-0 w-4 h-4 bg-[#8b8dc8] rounded-full border-[3px] border-white shadow-sm"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 py-1">
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <h3 className={`font-bold truncate text-[15px] ${unread ? "text-[#15157d]" : "text-slate-700"}`}>
                          {otherParticipant?.user.name || "Unknown"}
                        </h3>
                        {otherParticipant?.user.verified && (
                          <span className="material-symbols-outlined text-[#00a67e] text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                        )}
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${unread ? "text-primary" : "text-slate-400"}`}>
                        {lastMessage ? formatDistanceToNow(lastMessage.createdAt) : ""}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[9px] font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 uppercase tracking-tight">
                        {conv.listing.title}
                      </span>
                    </div>
                    
                    <p className={`text-sm leading-tight line-clamp-1 ${unread ? "font-bold text-slate-800" : "text-slate-500"}`}>
                      {lastMessage?.content || "Aucun message..."}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    {unread && (
                      <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse shadow-glow shadow-primary/30"></div>
                    )}
                    <span className="material-symbols-outlined text-slate-200 text-xl group-hover:translate-x-1 transition-transform">chevron_right</span>
                  </div>
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

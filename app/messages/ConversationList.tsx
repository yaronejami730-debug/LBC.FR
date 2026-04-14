"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "@/lib/utils";

interface Participant {
  userId: string;
  user: {
    id: string;
    name: string;
    avatar: string | null;
    verified: boolean;
  };
}

interface Conversation {
  id: string;
  updatedAt: string;
  listing: {
    id: string;
    title: string;
    price: number;
    images: string;
  };
  participants: Participant[];
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: string;
    read: boolean;
  } | null;
  unread: boolean;
}

export default function ConversationList({ currentUserId }: { currentUserId: string }) {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations?t=${Date.now()}`);
      if (!res.ok) return;
      const data: Conversation[] = await res.json();
      setConversations(data);
    } catch {
      // ignore network errors, retry on next poll
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 3000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Loading skeleton
  if (conversations === null) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-3xl p-4 flex items-center gap-4 bg-white border border-slate-100 animate-pulse">
            <div className="w-14 h-14 rounded-full bg-slate-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="py-24 text-center">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-4xl text-slate-300">chat_bubble</span>
        </div>
        <p className="text-xl font-bold text-[#2f6fb8]">On se sent un peu seul ?</p>
        <p className="text-slate-500 text-sm mt-2 mb-8">Commencez par contacter un vendeur depuis une annonce.</p>
        <Link
          href="/search"
          className="px-8 py-3.5 bg-[#2f6fb8] text-white rounded-full font-bold text-sm shadow-xl shadow-[#2f6fb8]/20 active:scale-95 transition-transform"
        >
          Explorer les annonces
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {conversations.map((conv) => {
        const otherParticipant = conv.participants.find((p) => p.userId !== currentUserId);
        const lastMessage = conv.lastMessage;
        const unread = conv.unread;

        let listingImage: string | null = null;
        try {
          const imgs = JSON.parse(conv.listing.images) as string[];
          listingImage = imgs[0] ?? null;
        } catch {
          listingImage = null;
        }

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
                  <img
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    alt={otherParticipant.user.name}
                    src={otherParticipant.user.avatar}
                  />
                ) : (
                  <span className="material-symbols-outlined text-2xl text-slate-300">person</span>
                )}
              </div>
              {unread && (
                <div className="absolute top-0 right-0 w-4 h-4 bg-[#8b8dc8] rounded-full border-[3px] border-white shadow-sm" />
              )}
            </div>

            <div className="flex-1 min-w-0 py-1">
              <div className="flex justify-between items-center mb-0.5">
                <div className="flex items-center gap-1.5">
                  <h3 className={`font-bold truncate text-[15px] ${unread ? "text-[#2f6fb8]" : "text-slate-700"}`}>
                    {otherParticipant?.user.name || "Unknown"}
                  </h3>
                  {otherParticipant?.user.verified && (
                    <span
                      className="material-symbols-outlined text-[#00a67e] text-xs"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      verified
                    </span>
                  )}
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${unread ? "text-primary" : "text-slate-400"}`}>
                  {lastMessage ? formatDistanceToNow(new Date(lastMessage.createdAt)) : ""}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex items-center gap-2 bg-[#f0f2f9] px-2 py-1.5 rounded-2xl border border-white shadow-sm">
                  {listingImage && (
                    <img
                      src={listingImage}
                      alt={conv.listing.title}
                      className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
                    />
                  )}
                  <div className="pr-1">
                    <p className="text-[9px] font-bold text-[#2f6fb8] line-clamp-1 max-w-[80px]">
                      {conv.listing.title}
                    </p>
                    <p className="text-[#2f6fb8] font-black text-xs">
                      {conv.listing.price.toLocaleString("fr-FR")} €
                    </p>
                  </div>
                </div>
              </div>

              <p className={`text-sm leading-tight line-clamp-1 ${unread ? "font-bold text-slate-800" : "text-slate-500"}`}>
                {lastMessage?.content || "Aucun message..."}
              </p>
            </div>

            <div className="flex flex-col items-center gap-2">
              {unread && (
                <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse shadow-glow shadow-primary/30" />
              )}
              <span className="material-symbols-outlined text-slate-200 text-xl group-hover:translate-x-1 transition-transform">
                chevron_right
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

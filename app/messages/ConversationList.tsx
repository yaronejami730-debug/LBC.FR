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
    <div className="space-y-2.5">
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
            className={`group relative rounded-2xl p-4 flex items-center gap-4 border transition-all duration-200 active:scale-[0.99]
              ${unread
                ? "bg-white border-[#2f6fb8]/20 shadow-[0_4px_20px_rgba(47,111,184,0.10)] hover:shadow-[0_6px_24px_rgba(47,111,184,0.15)]"
                : "bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300"}`}
          >
            {/* Indicateur non lu — barre gauche */}
            {unread && (
              <div className="absolute left-0 top-4 bottom-4 w-1 bg-[#2f6fb8] rounded-full" />
            )}

            {/* Avatar */}
            <div className="relative flex-shrink-0 ml-1">
              <div className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center
                ${unread ? "ring-2 ring-[#2f6fb8]/30" : "ring-2 ring-slate-100"}`}>
                {otherParticipant?.user.avatar ? (
                  <img
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    alt={otherParticipant.user.name}
                    src={otherParticipant.user.avatar}
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center text-lg font-bold
                    ${unread ? "bg-[#d5e3fc] text-[#2f6fb8]" : "bg-slate-100 text-slate-400"}`}>
                    {otherParticipant?.user.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </div>
              {unread && (
                <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#2f6fb8] rounded-full border-2 border-white" />
              )}
            </div>

            {/* Contenu */}
            <div className="flex-1 min-w-0">
              {/* Ligne nom + heure */}
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h3 className={`truncate text-[14px] ${unread ? "font-extrabold text-slate-900" : "font-semibold text-slate-700"}`}>
                    {otherParticipant?.user.name || "Inconnu"}
                  </h3>
                  {otherParticipant?.user.verified && (
                    <span className="material-symbols-outlined text-[#00a67e] text-[13px] flex-shrink-0"
                      style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold flex-shrink-0 ml-2 ${unread ? "text-[#2f6fb8]" : "text-slate-400"}`}>
                  {lastMessage ? formatDistanceToNow(new Date(lastMessage.createdAt)) : ""}
                </span>
              </div>

              {/* Dernier message */}
              <p className={`text-[13px] leading-snug line-clamp-1 mb-2 ${unread ? "font-semibold text-slate-800" : "text-slate-500"}`}>
                {lastMessage?.content || <span className="italic text-slate-400">Aucun message</span>}
              </p>

              {/* Badge annonce */}
              <div className="flex items-center gap-1.5 w-fit bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl">
                {listingImage && (
                  <img src={listingImage} alt={conv.listing.title}
                    className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-500 truncate max-w-[90px]">
                    {conv.listing.title}
                  </p>
                  <p className="text-[11px] font-bold text-[#2f6fb8] leading-tight">
                    {conv.listing.price.toLocaleString("fr-FR")} €
                  </p>
                </div>
              </div>
            </div>

            {/* Chevron */}
            <span className={`material-symbols-outlined text-[20px] flex-shrink-0 group-hover:translate-x-0.5 transition-transform
              ${unread ? "text-[#2f6fb8]" : "text-slate-300"}`}>
              chevron_right
            </span>
          </Link>
        );
      })}
    </div>
  );
}

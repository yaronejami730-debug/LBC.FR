"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  createdAt: string;
}

interface OtherUser {
  id: string;
  name: string;
  avatar: string | null;
  verified: boolean;
}

interface Listing {
  id: string;
  title: string;
  price: number;
  image: string | null;
}

export default function ChatWindow({
  conversationId,
  currentUserId,
  otherUser,
  listing,
  initialMessages,
}: {
  conversationId: string;
  currentUserId: string;
  otherUser: OtherUser | null;
  listing: Listing;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  // Handle focus to scroll to bottom (keyboard appearing)
  const handleFocus = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }, 300);
  };

  // Poll for new messages every 2 seconds
  const lastIdRef = useRef<string | undefined>(
    initialMessages[initialMessages.length - 1]?.id
  );
  useEffect(() => {
    lastIdRef.current = messages[messages.length - 1]?.id;
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const after = lastIdRef.current ? `&after=${lastIdRef.current}` : "";
      const res = await fetch(`/api/messages?conversationId=${conversationId}${after}`);
      if (!res.ok) return;
      const newMsgs: Message[] = await res.json();
      if (newMsgs.length === 0) return;
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const unique = newMsgs.filter((m) => !existingIds.has(m.id));
        return unique.length > 0 ? [...prev, ...unique] : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [conversationId]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const content = text.trim();
    setText("");
    try {
      const res = await fetch(`/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, content }),
      });
      const msg = await res.json();
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
    } finally {
      setSending(false);
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="bg-[#f8f9fc] text-on-surface flex flex-col h-[100dvh]">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-100 z-50 px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/messages" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-50 active:scale-95 transition-all">
          <span className="material-symbols-outlined text-[#15157d]">arrow_back</span>
        </Link>
        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0">
          {otherUser?.avatar ? (
            <img src={otherUser.avatar} alt={otherUser?.name} className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-outline">person</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 leading-tight">
            <h2 className="font-extrabold text-[#15157d] truncate text-base">{otherUser?.name || "Unknown"}</h2>
            {otherUser?.verified && (
              <span className="material-symbols-outlined text-[#00a67e] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 truncate font-medium">Répond généralement en 1h</p>
        </div>
        
        {/* Listing mini-card */}
        <Link href={`/listing/${listing.id}`} className="flex items-center gap-2 bg-[#f0f2f9] px-2 py-1.5 rounded-2xl border border-white shadow-sm flex-shrink-0">
          {listing.image && (
            <img src={listing.image} alt={listing.title} className="w-9 h-9 rounded-xl object-cover" />
          )}
          <div className="pr-1">
            <p className="text-[9px] font-bold text-[#15157d] line-clamp-1 max-w-[60px]">{listing.title}</p>
            <p className="text-[#15157d] font-black text-xs">{listing.price.toLocaleString("fr-FR")} €</p>
          </div>
        </Link>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 max-w-3xl w-full mx-auto no-scrollbar scroll-smooth">
        <div className="flex flex-col justify-end min-h-full py-6 space-y-6">
          {messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={`flex gap-3 ${isMe ? "justify-end" : "justify-start"}`}>
                {!isMe && (
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center flex-shrink-0 mt-auto">
                    {msg.senderAvatar ? (
                      <img src={msg.senderAvatar} alt={msg.senderName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-sm text-outline">person</span>
                    )}
                  </div>
                )}
                <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
                  <div
                    className={`px-4 py-3 text-sm leading-relaxed shadow-sm transition-all ${
                      isMe
                        ? "bg-[#252595] text-white rounded-[20px] rounded-br-[4px]"
                        : "bg-white text-on-surface rounded-[20px] rounded-bl-[4px]"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold px-2 uppercase tracking-tight">{formatTime(msg.createdAt)}</span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} className="h-2" />
        </div>
      </main>

      {/* Input */}
      <div className="bg-white/95 backdrop-blur-xl border-t border-slate-100 px-4 py-3 md:pb-6 z-50">
        <form
          onSubmit={sendMessage}
          className="max-w-3xl w-full mx-auto flex items-center gap-3"
        >
          <div className="flex-1 flex items-center bg-[#f1f3f5] rounded-full px-5 py-3 transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-[#15157d]/10">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={handleFocus}
              className="flex-1 bg-transparent border-none focus:ring-0 text-base outline-none text-on-surface placeholder:text-slate-400"
              placeholder="Écrivez un message..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90
              ${!text.trim() ? "bg-slate-100 text-slate-300" : "bg-[#8b8dc8] text-white shadow-[#8b8dc8]/20"}`}
          >
            <span className="material-symbols-outlined text-xl transform rotate-[-45deg] translate-x-0.5">send</span>
          </button>
        </form>
      </div>
    </div>
  );
}

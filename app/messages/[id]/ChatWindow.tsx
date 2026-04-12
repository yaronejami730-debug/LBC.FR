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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    <div className="bg-background text-on-surface flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-outline-variant/10 z-50 px-4 py-3 flex items-center gap-4 shadow-[0_8px_24px_rgba(21,21,125,0.04)]">
        <Link href="/messages" className="material-symbols-outlined text-[#15157d] active:scale-95 transition-transform">
          arrow_back
        </Link>
        <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container flex items-center justify-center">
          {otherUser?.avatar ? (
            <img src={otherUser.avatar} alt={otherUser?.name} className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-outline">person</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h2 className="font-bold text-on-surface truncate">{otherUser?.name || "Unknown"}</h2>
            {otherUser?.verified && (
              <span className="material-symbols-outlined text-tertiary-fixed-dim text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            )}
          </div>
          <p className="text-xs text-outline truncate">{listing.title}</p>
        </div>
        {/* Listing mini-card */}
        <Link href={`/listing/${listing.id}`} className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-xl ml-auto flex-shrink-0">
          {listing.image && (
            <img src={listing.image} alt={listing.title} className="w-10 h-10 rounded-lg object-cover" />
          )}
          <div>
            <p className="text-xs font-semibold text-on-surface line-clamp-1 max-w-[80px]">{listing.title}</p>
            <p className="text-primary font-bold text-sm">{listing.price.toLocaleString("fr-FR")} €</p>
          </div>
        </Link>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl w-full mx-auto">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUserId;
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
              {!isMe && (
                <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container flex items-center justify-center flex-shrink-0">
                  {msg.senderAvatar ? (
                    <img src={msg.senderAvatar} alt={msg.senderName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-sm text-outline">person</span>
                  )}
                </div>
              )}
              <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? "bg-gradient-to-br from-primary to-primary-container text-white rounded-tr-sm"
                      : "bg-surface-container-lowest text-on-surface rounded-tl-sm shadow-sm"
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-outline px-1">{formatTime(msg.createdAt)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <form
        onSubmit={sendMessage}
        className="bg-white/90 backdrop-blur-xl border-t border-outline-variant/10 px-4 py-4 flex items-center gap-3 max-w-2xl w-full mx-auto"
      >
        <div className="flex-1 flex items-center bg-surface-container-low rounded-full px-4 py-3 gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm outline-none text-on-surface placeholder:text-outline/60"
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
          className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-container text-white flex items-center justify-center shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm">send</span>
        </button>
      </form>
    </div>
  );
}

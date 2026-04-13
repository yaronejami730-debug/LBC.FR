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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  function scrollToBottom(behavior: ScrollBehavior = "auto") {
    bottomRef.current?.scrollIntoView({ behavior });
  }

  useEffect(() => {
    scrollToBottom("auto");
  }, []);

  useEffect(() => {
    scrollToBottom("smooth");
  }, [messages]);

  // Sur iOS, quand le clavier apparaît, scroll to bottom
  useEffect(() => {
    const input = document.querySelector("input[data-chat]") as HTMLInputElement;
    if (!input) return;
    const onFocus = () => setTimeout(() => scrollToBottom("smooth"), 350);
    input.addEventListener("focus", onFocus);
    return () => input.removeEventListener("focus", onFocus);
  }, []);

  // Poll toutes les 2 secondes
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
    <div
      className="bg-[#f8f9fc] text-on-surface flex flex-col"
      style={{ height: "100dvh" }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-white/95 backdrop-blur-xl border-b border-slate-100 z-40 px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link
          href="/messages"
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-50 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[#2f6fb8]">arrow_back</span>
        </Link>

        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0">
          {otherUser?.avatar ? (
            <img src={otherUser.avatar} alt={otherUser.name} className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-outline">person</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 leading-tight">
            <h2 className="font-extrabold text-[#2f6fb8] truncate text-base">
              {otherUser?.name || "Unknown"}
            </h2>
            {otherUser?.verified && (
              <span
                className="material-symbols-outlined text-[#00a67e] text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 truncate font-medium">
            Répond généralement en 1h
          </p>
        </div>

        <Link
          href={`/listing/${listing.id}`}
          className="flex items-center gap-2 bg-[#f0f2f9] px-2 py-1.5 rounded-2xl border border-white shadow-sm flex-shrink-0"
        >
          {listing.image && (
            <img src={listing.image} alt={listing.title} className="w-9 h-9 rounded-xl object-cover" />
          )}
          <div className="pr-1">
            <p className="text-[9px] font-bold text-[#2f6fb8] line-clamp-1 max-w-[60px]">
              {listing.title}
            </p>
            <p className="text-[#2f6fb8] font-black text-xs">
              {listing.price.toLocaleString("fr-FR")} €
            </p>
          </div>
        </Link>
      </header>

      {/* ── Messages ───────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4"
      >
        <div className="max-w-3xl mx-auto py-4 flex flex-col gap-4">
          {messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isMe ? "justify-end" : "justify-start"}`}
              >
                {!isMe && (
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center flex-shrink-0 self-end mb-5">
                    {msg.senderAvatar ? (
                      <img src={msg.senderAvatar} alt={msg.senderName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-sm text-outline">person</span>
                    )}
                  </div>
                )}
                <div className={`max-w-[78%] flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
                  <div
                    className={`px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                      isMe
                        ? "bg-[#1a5a9e] text-white rounded-[20px] rounded-br-[5px]"
                        : "bg-white text-on-surface rounded-[20px] rounded-bl-[5px]"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold px-1 uppercase tracking-tight">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
          {/* Ancre de scroll */}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input ──────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-4 pt-3 z-40"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <form
          onSubmit={sendMessage}
          className="max-w-3xl w-full mx-auto flex items-center gap-3"
        >
          <div className="flex-1 flex items-center bg-[#f1f3f5] rounded-full px-5 py-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#2f6fb8]/10 transition-all">
            <input
              data-chat
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-base outline-none text-on-surface placeholder:text-slate-400"
              placeholder="Écrivez un message..."
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e as unknown as React.FormEvent);
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all active:scale-90 flex-shrink-0
              ${!text.trim() ? "bg-slate-100 text-slate-300" : "bg-[#2f6fb8] text-white shadow-[#2f6fb8]/30"}`}
          >
            <span className="material-symbols-outlined text-xl" style={{ transform: "rotate(-45deg) translateX(2px)" }}>
              send
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}

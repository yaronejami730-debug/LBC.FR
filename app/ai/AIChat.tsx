"use client";

import { useEffect, useRef, useState } from "react";
import ListingCard, { type HomeListing } from "@/components/home/ListingCard";

type Role = "user" | "assistant";

type Turn = {
  role: Role;
  content: string;
  listings?: HomeListing[];
  suggestions?: string[];
};

const STARTER_CHIPS = [
  { emoji: "🚗", label: "Une voiture" },
  { emoji: "🏠", label: "Un logement" },
  { emoji: "🛋️", label: "Du mobilier" },
  { emoji: "👕", label: "De la mode" },
  { emoji: "🎁", label: "Surprends-moi" },
];

export default function AIChat() {
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      content:
        "Salut ! Moi c'est Déborah 👋 On va jouer aux questions-réponses pour trouver ton bonheur. Tu cherches quoi ?",
      suggestions: STARTER_CHIPS.map((c) => c.label),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError("");

    const nextTurns: Turn[] = [...turns, { role: "user", content: trimmed }];
    setTurns(nextTurns);
    setInput("");
    setLoading(true);

    try {
      const messages = nextTurns
        .filter((t) => t.role === "user" || t.role === "assistant")
        .map((t) => ({ role: t.role, content: t.content }));

      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erreur");

      const dateRevived: HomeListing[] = (data.listings ?? []).map(
        (l: HomeListing & { createdAt: string }) => ({
          ...l,
          createdAt: new Date(l.createdAt),
        }),
      );

      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply ?? "",
          listings: dateRevived.length > 0 ? dateRevived : undefined,
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : undefined,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setTurns([
      {
        role: "assistant",
        content:
          "On repart à zéro ✨ Dis-moi ce que tu cherches.",
      },
    ]);
    setInput("");
    setError("");
  }

  const lastAssistant = [...turns].reverse().find((t) => t.role === "assistant");

  return (
    <div className="flex flex-col gap-5">
      {/* Conversation */}
      <div className="relative bg-white rounded-3xl border border-[#e6e8eb] shadow-[0_4px_24px_rgba(15,23,42,0.04)] overflow-hidden">
        {/* Halo décoratif top */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#2f6fb8]/8 to-transparent pointer-events-none" />

        <div className="relative p-4 md:p-6 min-h-[440px] max-h-[65vh] overflow-y-auto flex flex-col gap-4">
          {turns.map((t, i) => (
            <TurnBubble key={i} turn={t} />
          ))}

          {loading && <TypingBubble />}

          <div ref={endRef} />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 font-semibold px-2">{error}</p>
      )}

      {/* Suggestions cliquables sous la dernière réponse de l'assistant */}
      {!loading && lastAssistant?.suggestions && lastAssistant.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lastAssistant.suggestions.map((s) => {
            const chip = STARTER_CHIPS.find((c) => c.label === s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="group flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#2f6fb8] bg-white border border-[#2f6fb8]/25 hover:border-[#2f6fb8] hover:bg-[#2f6fb8]/8 hover:shadow-sm rounded-full transition-all"
              >
                {chip && <span className="text-base group-hover:scale-110 transition-transform">{chip.emoji}</span>}
                {s}
              </button>
            );
          })}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 items-end bg-white border border-[#e6e8eb] focus-within:border-[#2f6fb8] focus-within:ring-2 focus-within:ring-[#2f6fb8]/20 rounded-2xl p-1.5 transition-all"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Décris ce que tu cherches…"
          className="flex-1 resize-none px-3 py-2.5 bg-transparent text-[#191c1e] text-sm focus:outline-none min-h-[44px] max-h-32"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="h-11 w-11 flex items-center justify-center rounded-xl bg-gradient-to-br from-[#2f6fb8] to-[#1a5a9e] text-white disabled:opacity-30 hover:shadow-md hover:scale-[1.03] active:scale-95 transition-all"
          aria-label="Envoyer"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
        </button>
      </form>

      <div className="flex items-center justify-between text-[11px] text-[#9ca3af] px-2">
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">info</span>
          Réponses générées par IA — vérifie toujours avant contact.
        </span>
        <button
          type="button"
          onClick={reset}
          className="font-semibold hover:text-[#2f6fb8] transition-colors flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[14px]">restart_alt</span>
          Recommencer
        </button>
      </div>
    </div>
  );
}

function TurnBubble({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-gradient-to-br from-[#2f6fb8] to-[#1a5a9e] text-white text-sm leading-relaxed rounded-2xl rounded-tr-md px-4 py-2.5 shadow-sm">
          {turn.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <AssistantAvatar />
        <div className="max-w-[85%] bg-[#f4f6f8] text-[#191c1e] text-sm leading-relaxed rounded-2xl rounded-tl-md px-4 py-2.5">
          {turn.content}
        </div>
      </div>

      {turn.listings && turn.listings.length > 0 && (
        <div className="pl-11">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {turn.listings.map((l) => (
              <ListingCard key={l.id} listing={l} size="md" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-start gap-2.5">
      <AssistantAvatar />
      <div className="bg-[#f4f6f8] text-[#777683] text-sm rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#2f6fb8] animate-pulse" />
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#2f6fb8] animate-pulse [animation-delay:0.15s]" />
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#2f6fb8] animate-pulse [animation-delay:0.3s]" />
      </div>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[#2f6fb8] via-[#3a86d6] to-[#7b3fd6] flex items-center justify-center shadow-sm ring-2 ring-white">
      <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
        auto_awesome
      </span>
    </div>
  );
}

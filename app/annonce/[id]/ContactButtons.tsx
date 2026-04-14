"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export default function ContactButtons({
  listingId,
  sellerId,
}: {
  listingId: string;
  sellerId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startConversation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, sellerId }),
      });
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }
      if (res.status === 400) {
        const data = await res.json();
        setError(data.error || "Impossible d'envoyer un message.");
        return;
      }
      const data = await res.json();
      router.push(`/messages/${data.id}`);
    } catch {
      setError("Une erreur est survenue. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-2xl z-[60] px-4 py-4 border-t border-slate-100 shadow-[0_-8px_32px_rgba(21,21,125,0.06)]">
      <div className="flex items-center gap-3 w-full max-w-2xl mx-auto">
        {/* Message Button */}
        <button
          onClick={startConversation}
          disabled={loading}
          className="flex-1 h-12 rounded-2xl bg-[#2f6fb8] text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70 shadow-lg shadow-blue-900/10"
        >
          <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
          <span className="text-sm">{loading ? "..." : "Message"}</span>
        </button>

        {/* Call Button (Placeholder for now) */}
        <button
          className="w-12 h-12 rounded-2xl bg-slate-100 text-[#2f6fb8] font-bold flex items-center justify-center active:scale-95 transition-all"
          onClick={() => alert("Fonctionnalité d'appel bientôt disponible !")}
        >
          <span className="material-symbols-outlined text-[20px]">call</span>
        </button>

        {/* View Profile Button */}
        <button
          onClick={() => router.push(`/u/${sellerId}`)}
          className="flex-1 h-12 rounded-2xl bg-white border border-slate-200 text-[#2f6fb8] font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[20px]">person</span>
          <span className="text-sm">Profil</span>
        </button>
      </div>
      {error && (
        <p className="text-red-500 text-[10px] text-center mt-2 font-medium">{error}</p>
      )}
    </div>
  );
}

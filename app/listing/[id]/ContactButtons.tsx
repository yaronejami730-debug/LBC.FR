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
    <div className="fixed bottom-0 left-0 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl z-[60] px-6 py-4 flex flex-col items-center gap-2 border-t border-outline-variant/10 md:justify-center">
      {error && (
        <p className="text-red-500 text-sm font-medium">{error}</p>
      )}
      <div className="flex items-center gap-4 w-full max-w-2xl">
        <button
          onClick={startConversation}
          disabled={loading}
          className="flex-1 py-4 px-6 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-extrabold flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(21,21,125,0.2)] active:scale-[0.98] transition-all disabled:opacity-70"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
          {loading ? "Ouverture..." : "Contacter le vendeur"}
        </button>
      </div>
    </div>
  );
}

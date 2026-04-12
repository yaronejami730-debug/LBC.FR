"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function SellerActions({
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
      setError("Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 w-full">
      {/* View Profile Button - Large & Clear */}
      <Link 
        href={`/u/${sellerId}`}
        className="w-full py-4 rounded-2xl bg-slate-100 text-[#15157d] font-bold text-sm hover:bg-slate-200 transition-all text-center block"
      >
        Voir le profil
      </Link>

      {/* Message and Phone buttons side-by-side */}
      <div className="flex gap-3">
        <button
          onClick={startConversation}
          disabled={loading}
          className="flex-1 py-4 px-4 rounded-2xl bg-[#15157d] text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70 shadow-lg shadow-blue-900/10"
        >
          <span className="material-symbols-outlined text-[18px]">chat</span>
          <span className="text-sm">{loading ? "..." : "Message"}</span>
        </button>

        <button
          onClick={() => alert("Fonctionnalité d'appel bientôt disponible !")}
          className="flex-1 py-4 px-4 rounded-2xl bg-white border border-slate-200 text-[#15157d] font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">call</span>
          <span className="text-sm">Téléphone</span>
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-[10px] text-center mt-1 font-medium">{error}</p>
      )}
    </div>
  );
}

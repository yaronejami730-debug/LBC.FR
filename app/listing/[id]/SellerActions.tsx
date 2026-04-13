"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function SellerActions({
  listingId,
  sellerId,
  phone,
  hidePhone,
}: {
  listingId: string;
  sellerId: string;
  phone: string | null;
  hidePhone: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneRevealed, setPhoneRevealed] = useState(false);

  const hasPhone = !!phone && !hidePhone;

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
      {/* View Profile */}
      <Link
        href={`/u/${sellerId}`}
        className="w-full py-4 rounded-2xl bg-slate-100 text-[#2f6fb8] font-bold text-sm hover:bg-slate-200 transition-all text-center block"
      >
        Voir le profil
      </Link>

      {/* Message — full width if no phone, half width otherwise */}
      <div className={`flex gap-3 ${hasPhone ? "" : ""}`}>
        <button
          onClick={startConversation}
          disabled={loading}
          className={`py-4 px-4 rounded-2xl bg-[#2f6fb8] text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70 shadow-lg shadow-blue-900/10 ${hasPhone ? "flex-1" : "w-full"}`}
        >
          <span className="material-symbols-outlined text-[18px]">chat</span>
          <span className="text-sm">{loading ? "..." : "Message"}</span>
        </button>

        {/* Phone button — only if number exists and not hidden */}
        {hasPhone && (
          <div className="flex-1">
            {phoneRevealed ? (
              <a
                href={`tel:${phone}`}
                className="w-full h-full py-4 px-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm text-sm"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
                <span className="truncate">{phone}</span>
              </a>
            ) : (
              <button
                onClick={() => setPhoneRevealed(true)}
                className="w-full py-4 px-4 rounded-2xl bg-white border border-slate-200 text-[#2f6fb8] font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm text-sm"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
                <span>Afficher</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* If phone exists but hidden — info message */}
      {phone && hidePhone && (
        <p className="text-[11px] text-slate-400 text-center font-medium">
          Le vendeur préfère être contacté par messagerie
        </p>
      )}

      {error && (
        <p className="text-red-500 text-[10px] text-center mt-1 font-medium">{error}</p>
      )}
    </div>
  );
}

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
  const hasWhatsApp = !!phone;

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

      {/* WhatsApp button — shows whenever a phone exists, even if hidden (WhatsApp doesn't reveal the raw number) */}
      {hasWhatsApp && (
        <a
          href={`https://wa.me/${phone!.replace(/[\s\-().+]/g, "").replace(/^0/, "33")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-4 px-4 rounded-2xl bg-[#25D366] text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-green-900/10 text-sm"
        >
          {/* WhatsApp SVG icon */}
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <span>Contacter par WhatsApp</span>
        </a>
      )}

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

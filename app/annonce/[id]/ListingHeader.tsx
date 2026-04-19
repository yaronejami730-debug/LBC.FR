"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ListingHeader({
  title,
  listingId,
  initialFavorite,
  userId,
  images = [],
}: {
  title: string;
  listingId: string;
  initialFavorite: boolean;
  userId: string | null;
  images?: string[];
}) {
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [loading, setLoading] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  // Close menu when clicking outside
  useEffect(() => {
    if (!showShareMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowShareMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showShareMenu]);

  const getShareData = () => {
    const url = window.location.href;
    const text = `Salut ! J'ai trouvé ça sur Deal&Co, ça pourrait te plaire 😊\n${title}`;
    return { url, text };
  };

  const handleWhatsApp = () => {
    const { url, text } = getShareData();
    setShowShareMenu(false);
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleEmail = () => {
    const { url, text } = getShareData();
    const subject = encodeURIComponent(title + " — Deal&Co");
    const body = encodeURIComponent(text + "\n\n" + url);
    const mailto = `mailto:?subject=${subject}&body=${body}`;
    const a = document.createElement("a");
    a.href = mailto;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShowShareMenu(false);
  };

  const handleCopyLink = async () => {
    const { url } = getShareData();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowShareMenu(false);
  };

  const handleNativeShare = async () => {
    const { url, text } = getShareData();
    try {
      await navigator.share({ title, text, url });
    } catch {
      // user cancelled
    }
    setShowShareMenu(false);
  };

  const toggleFavorite = async () => {
    if (!userId) {
      window.location.href = `/login?callbackUrl=/annonce/${listingId}`;
      return;
    }
    setLoading(true);
    try {
      const method = isFavorite ? "DELETE" : "POST";
      await fetch("/api/favorites", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      setIsFavorite(!isFavorite);
    } finally {
      setLoading(false);
    }
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-xl shadow-sm border-b border-slate-100">
      <div className="flex items-center justify-between px-6 py-4 w-full max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
            aria-label="Retour"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <img src="/logo.png" alt="Deal&Co" className="h-12 w-auto" />
        </div>
        <div className="flex items-center gap-2">
          {/* Share button + dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowShareMenu((prev) => !prev)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-primary active:scale-95 transition-all"
              aria-label="Partager"
            >
              <span className="material-symbols-outlined text-[22px]">share</span>
            </button>

            {showShareMenu && (
              <div className="absolute right-0 top-12 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* WhatsApp */}
                <button
                  onClick={handleWhatsApp}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="#25D366">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span className="text-sm font-medium text-slate-700">WhatsApp</span>
                </button>

                {/* Email */}
                <button
                  onClick={handleEmail}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-t border-slate-50"
                >
                  <span className="material-symbols-outlined text-[20px] text-slate-500 shrink-0">mail</span>
                  <span className="text-sm font-medium text-slate-700">E-mail</span>
                </button>

                {/* Copy link */}
                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-t border-slate-50"
                >
                  <span className="material-symbols-outlined text-[20px] text-slate-500 shrink-0">
                    {copied ? "check_circle" : "link"}
                  </span>
                  <span className={`text-sm font-medium ${copied ? "text-emerald-600" : "text-slate-700"}`}>
                    {copied ? "Lien copié !" : "Copier le lien"}
                  </span>
                </button>

                {/* Native share — only shown on supported devices */}
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <button
                    onClick={handleNativeShare}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-t border-slate-50"
                  >
                    <span className="material-symbols-outlined text-[20px] text-slate-500 shrink-0">ios_share</span>
                    <span className="text-sm font-medium text-slate-700">Plus d&apos;options</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={toggleFavorite}
            disabled={loading}
            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all
              ${isFavorite ? "text-red-500 bg-red-50" : "text-slate-600 hover:bg-slate-50 hover:text-red-500"}`}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={{ fontVariationSettings: isFavorite ? "'FILL' 1" : "'FILL' 0" }}
            >
              favorite
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}

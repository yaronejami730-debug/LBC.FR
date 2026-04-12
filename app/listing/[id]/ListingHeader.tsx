"use client";

import Link from "next/link";
import { useState } from "react";

export default function ListingHeader({
  title,
  listingId,
  initialFavorite,
  userId,
}: {
  title: string;
  listingId: string;
  initialFavorite: boolean;
  userId: string | null;
}) {
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `Regardez cette annonce sur Le Bon Deal : ${title}`, url });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert("Lien copié !");
    }
  };

  const toggleFavorite = async () => {
    if (!userId) {
      window.location.href = `/login?callbackUrl=/listing/${listingId}`;
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
          <Link
            href="/search"
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <img src="/logo.png" alt="Le Bon Deal" className="h-12 w-auto" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-primary active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[22px]">share</span>
          </button>
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

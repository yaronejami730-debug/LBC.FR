"use client";

import Link from "next/link";
import { useState } from "react";

export default function ListingHeader({ title, url }: { title: string; url: string }) {
  const [isFavorite, setIsFavorite] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: `Regardez cette annonce sur PrèsDeToi : ${title}`,
          url: url,
        });
      } catch (err) {
        console.log("Erreur lors du partage :", err);
      }
    } else {
      // Fallback: copier dans le presse-papier
      navigator.clipboard.writeText(url);
      alert("Lien copié dans le presse-papier !");
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
          <span className="font-['Manrope'] font-extrabold text-xl tracking-tighter text-[#15157d]">
            PrèsDeToi
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleShare}
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-primary active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[22px]">share</span>
          </button>
          <button 
            onClick={() => setIsFavorite(!isFavorite)}
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

"use client";

import { useState, useRef, useEffect } from "react";

export default function ListingInfoTip() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center self-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-4 h-4 rounded-full border border-[#2f6fb8]/40 text-[#2f6fb8]/60 flex items-center justify-center hover:border-[#2f6fb8] hover:text-[#2f6fb8] transition-colors"
        aria-label="Information"
      >
        <span className="text-[9px] font-bold leading-none">i</span>
      </button>

      {open && (
        <div className="absolute left-6 bottom-full mb-2 z-50 w-64 bg-white border border-[#eceef0] rounded-xl shadow-lg p-3.5">
          <p className="text-xs text-[#424751] leading-relaxed">
            Votre annonce est <strong style={{color:"#1a1b25"}}>en ligne</strong> et visible par tous.
            Elle peut faire l'objet d'une vérification dans les 24 à 48 h et pourra être retirée si elle ne respecte pas nos conditions d'utilisation.
          </p>
          <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-white border-b border-r border-[#eceef0] rotate-45" />
        </div>
      )}
    </div>
  );
}

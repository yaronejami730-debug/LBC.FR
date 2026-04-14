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
    <div ref={ref} className="relative inline-flex items-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-5 h-5 rounded-full bg-[#2f6fb8] text-white flex items-center justify-center flex-shrink-0 hover:bg-[#1a5a9e] transition-colors"
        aria-label="Information sur l'annonce"
      >
        <span className="text-[11px] font-black leading-none">i</span>
      </button>

      {open && (
        <div className="absolute left-7 top-1/2 -translate-y-1/2 z-50 w-72 bg-white border border-[#d5e3fc] rounded-2xl shadow-xl p-4">
          <p className="text-sm text-[#1a2b4a] leading-relaxed">
            Votre annonce est <strong>en ligne</strong> et visible par tous.{" "}
            Elle peut faire l'objet d'une vérification par notre équipe dans les 24 à 48 h.
            Si elle ne respecte pas nos conditions d'utilisation, elle pourra être retirée du site.
          </p>
          <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-l border-t border-[#d5e3fc] rotate-[-45deg]" />
        </div>
      )}
    </div>
  );
}

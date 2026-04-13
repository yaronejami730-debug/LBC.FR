"use client";

import { usePresence } from "@/hooks/usePresence";

export default function LiveVisitorCount() {
  const count = usePresence("platform", "admin");

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#eceef0] transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-100 text-emerald-700 relative">
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            wifi
          </span>
          {/* Live dot */}
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
          </span>
        </div>
        <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
          En direct
        </span>
      </div>
      <p className="text-3xl font-extrabold text-[#191c1e] mt-4 font-headline transition-all duration-150">
        {count}
      </p>
      <p className="text-sm text-[#777683] mt-0.5">Visiteurs en ce moment</p>
    </div>
  );
}

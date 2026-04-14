"use client";

import { useEffect, useState } from "react";

const KEY = "dealco_viewed";

export default function DejaVuBadge({ listingId }: { listingId: string }) {
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const viewed: string[] = JSON.parse(raw);
      setSeen(viewed.includes(listingId));
    } catch { /* ignore */ }
  }, [listingId]);

  if (!seen) return null;

  return (
    <span className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
      <span className="w-1.5 h-1.5 rounded-full bg-white/70 flex-shrink-0" />
      Déjà vu
    </span>
  );
}

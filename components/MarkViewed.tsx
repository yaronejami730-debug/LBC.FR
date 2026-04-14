"use client";

import { useEffect } from "react";

const KEY = "dealco_viewed";
const MAX = 200;

export default function MarkViewed({ listingId }: { listingId: string }) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const viewed: string[] = raw ? JSON.parse(raw) : [];
      if (!viewed.includes(listingId)) {
        const updated = [listingId, ...viewed].slice(0, MAX);
        localStorage.setItem(KEY, JSON.stringify(updated));
      }
    } catch { /* ignore */ }
  }, [listingId]);

  return null;
}

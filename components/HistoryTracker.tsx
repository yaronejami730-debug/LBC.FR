"use client";

import { useEffect } from "react";
import { recordVisit } from "@/lib/search-history";

/** Invisible component — records a category visit on mount. */
export default function HistoryTracker({ category }: { category: string }) {
  useEffect(() => {
    if (category) recordVisit(category);
  }, [category]);
  return null;
}

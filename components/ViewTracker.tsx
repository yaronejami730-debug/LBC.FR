"use client";

import { useEffect } from "react";
import { track } from "@/lib/event-tracker";

export default function ViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    fetch(`/api/listings/${listingId}/view`, { method: "POST" }).catch(() => {});
    track("listing_view", { listingId });
  }, [listingId]);

  return null;
}

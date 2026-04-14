"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "@/lib/utils";

type ListingSummary = {
  id: string;
  title: string;
  price: number;
  location: string;
  createdAt: string;
  images: string;
  status: string;
  viewCount: number;
};

type SSEInit = { type: "init"; listings: { id: string; viewCount: number }[] };
type SSEUpdate = { type: "update"; listingId: string; viewCount: number };

export default function PerformanceSection({
  listings,
}: {
  listings: ListingSummary[];
}) {
  const [viewCounts, setViewCounts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const l of listings) init[l.id] = l.viewCount;
    return init;
  });
  const [connected, setConnected] = useState(false);
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const es = new EventSource("/api/profile/views/stream");

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as SSEInit | SSEUpdate;
        if (data.type === "init") {
          setViewCounts((prev) => {
            const next = { ...prev };
            for (const l of data.listings) next[l.id] = l.viewCount;
            return next;
          });
        } else if (data.type === "update") {
          setViewCounts((prev) => ({ ...prev, [data.listingId]: data.viewCount }));
          setUpdatedIds((prev) => new Set([...prev, data.listingId]));
          setTimeout(() => {
            setUpdatedIds((prev) => {
              const next = new Set(prev);
              next.delete(data.listingId);
              return next;
            });
          }, 1200);
        }
      } catch {}
    };

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  const totalViews = Object.values(viewCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Header stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(21,21,125,0.05)] text-center">
          <p className="text-3xl font-extrabold text-primary font-['Manrope']">
            {totalViews.toLocaleString("fr-FR")}
          </p>
          <p className="text-outline text-xs mt-1">Vues totales</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(21,21,125,0.05)] text-center flex flex-col items-center justify-center gap-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-green-500" : "bg-slate-300"
              }`}
            />
            <p className="text-xs font-bold text-on-surface">
              {connected ? "En direct" : "Connexion…"}
            </p>
          </div>
          <p className="text-outline text-xs">{listings.length} annonce{listings.length !== 1 ? "s" : ""} actives</p>
        </div>
      </div>

      {/* Listings list */}
      {listings.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-[0_2px_12px_rgba(21,21,125,0.05)]">
          <span className="material-symbols-outlined text-4xl text-outline/40 block mb-3">bar_chart</span>
          <p className="text-on-surface-variant font-medium">Aucune annonce à analyser</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const imgs = JSON.parse(listing.images) as string[];
            const img = imgs[0] ?? "";
            const count = viewCounts[listing.id] ?? 0;
            const isUpdating = updatedIds.has(listing.id);

            return (
              <Link
                key={listing.id}
                href={`/annonce/${listing.id}`}
                className="group flex items-center gap-4 bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(21,21,125,0.04)] border border-surface-container hover:shadow-md transition-all"
              >
                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface-container-low flex-shrink-0">
                  {img ? (
                    <img
                      src={img}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl text-outline/30">image</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-on-surface font-semibold text-sm leading-snug line-clamp-1">
                    {listing.title}
                  </p>
                  <p className="text-primary font-bold text-sm">
                    {listing.price.toLocaleString("fr-FR")} €
                  </p>
                  <p className="text-outline/70 text-[11px]">
                    {formatDistanceToNow(new Date(listing.createdAt))}
                  </p>
                </div>

                {/* View count */}
                <div
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-300 ${
                    isUpdating
                      ? "bg-green-50 scale-110"
                      : "bg-surface-container-low"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      isUpdating ? "text-green-600" : "text-outline"
                    }`}
                    style={{ fontVariationSettings: isUpdating ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    visibility
                  </span>
                  <span
                    className={`text-base font-extrabold font-['Manrope'] transition-colors ${
                      isUpdating ? "text-green-600" : "text-on-surface"
                    }`}
                  >
                    {count.toLocaleString("fr-FR")}
                  </span>
                  <span className="text-[9px] text-outline uppercase tracking-wide">
                    vue{count !== 1 ? "s" : ""}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

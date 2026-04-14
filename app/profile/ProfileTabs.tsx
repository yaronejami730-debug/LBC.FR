"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "@/lib/utils";
import PerformanceSection from "./PerformanceSection";

type Listing = {
  id: string;
  title: string;
  price: number;
  location: string;
  createdAt: Date;
  images: string;
  status: string;
  isPremium: boolean;
  viewCount: number;
};

export default function ProfileTabs({ listings }: { listings: Listing[] }) {
  const [tab, setTab] = useState<"annonces" | "performance">("annonces");

  // Serialize dates for PerformanceSection (client component)
  const serialized = listings.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div>
      {/* Tabs */}
      <div className="flex bg-surface-container-low rounded-2xl p-1 mb-6 gap-1">
        <button
          onClick={() => setTab("annonces")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
            tab === "annonces"
              ? "bg-white text-primary shadow-sm"
              : "text-outline hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">sell</span>
          Mes annonces
        </button>
        <button
          onClick={() => setTab("performance")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
            tab === "performance"
              ? "bg-white text-primary shadow-sm"
              : "text-outline hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">bar_chart</span>
          Performance
        </button>
      </div>

      {/* Header row */}
      {tab === "annonces" && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-extrabold text-on-surface font-['Manrope']">Mes annonces</h3>
          <Link href="/post" className="flex items-center gap-1 text-primary text-sm font-semibold">
            <span className="material-symbols-outlined text-base">add</span>
            Nouvelle annonce
          </Link>
        </div>
      )}
      {tab === "performance" && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-extrabold text-on-surface font-['Manrope']">Performance</h3>
          <span className="flex items-center gap-1.5 text-[11px] text-outline font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Mise à jour en direct
          </span>
        </div>
      )}

      {/* Content */}
      {tab === "annonces" ? (
        listings.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-[0_2px_12px_rgba(21,21,125,0.05)]">
            <span className="material-symbols-outlined text-4xl text-outline/40 block mb-3">sell</span>
            <p className="text-on-surface-variant font-medium">
              Vous n&apos;avez pas encore d&apos;annonces
            </p>
            <Link
              href="/post"
              className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-bold text-sm shadow-md shadow-primary/20 active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Déposer une annonce
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {listings.map((listing) => {
              const images = JSON.parse(listing.images) as string[];
              const img = images[0] || "";
              return (
                <Link
                  key={listing.id}
                  href={`/annonce/${listing.id}`}
                  className="group flex flex-col bg-white rounded-xl overflow-hidden border border-surface-container hover:shadow-md transition-all duration-200"
                >
                  <div className="relative aspect-square overflow-hidden bg-surface-container-low">
                    {img ? (
                      <img
                        src={img}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-outline/30">image</span>
                      </div>
                    )}
                    {listing.isPremium && (
                      <span className="absolute top-2 left-2 bg-secondary-container text-on-secondary-container text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Premium
                      </span>
                    )}
                    {listing.status === "PENDING" && (
                      <span className="absolute top-2 right-2 bg-amber-100 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        En attente
                      </span>
                    )}
                    {listing.status === "REJECTED" && (
                      <span className="absolute top-2 right-2 bg-red-100 text-red-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Refusée
                      </span>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col gap-0.5">
                    <p className="text-on-surface font-semibold text-sm leading-snug line-clamp-2">
                      {listing.title}
                    </p>
                    <p className="text-primary font-bold text-base mt-1">
                      {listing.price.toLocaleString("fr-FR")} €
                    </p>
                    <p className="text-outline text-xs truncate">{listing.location}</p>
                    <p className="text-outline/70 text-[10px]">
                      {formatDistanceToNow(listing.createdAt)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )
      ) : (
        <PerformanceSection listings={serialized} />
      )}
    </div>
  );
}

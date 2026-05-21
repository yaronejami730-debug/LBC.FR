"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTopCategories } from "@/lib/search-history";
import { CATEGORIES } from "@/lib/categories";
import ListingCard from "@/components/home/ListingCard";

interface Listing {
  id: string;
  title: string;
  price: number;
  location: string;
  images: string;
  createdAt: string;
  category: string;
  isPremium: boolean;
}

interface CategorySection {
  category: string;
  listings: Listing[];
}

export default function HomeRecommendations() {
  const [sections, setSections] = useState<CategorySection[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tops = getTopCategories(3);
    if (tops.length === 0) { setLoading(false); return; }

    Promise.all(
      tops.map(async (cat) => {
        const res = await fetch(
          `/api/listings?category=${encodeURIComponent(cat)}&page=1`,
          { cache: "no-store" }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const listings: Listing[] = (data.listings || []).slice(0, 10);
        return listings.length > 0 ? { category: cat, listings } : null;
      })
    ).then((results) => {
      setSections(results.filter(Boolean) as CategorySection[]);
      setLoading(false);
    });
  }, []);

  if (loading || sections.length === 0) return null;

  const current = sections[activeTab];
  const catDef = CATEGORIES.find((c) => c.label === current.category);

  return (
    <section className="px-4 md:px-6 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <span className="text-primary font-bold uppercase tracking-[0.1em] text-[11px]">Basé sur vos recherches</span>
          <h3 className="text-xl font-extrabold text-on-surface tracking-tight">Pour vous</h3>
        </div>
        <Link
          href={`/annonces/${current.category
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")}`}
          title={`Voir toutes les annonces ${current.category}`}
          className="text-primary text-sm font-semibold flex items-center gap-1 group"
        >
          Voir tout
          <span className="material-symbols-outlined text-base group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
        </Link>
      </div>

      {/* Category tabs */}
      {sections.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
          {sections.map((s, i) => {
            const def = CATEGORIES.find((c) => c.label === s.category);
            return (
              <button
                key={s.category}
                onClick={() => setActiveTab(i)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all shrink-0 ${
                  activeTab === i
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "bg-surface-container text-on-surface-variant hover:bg-slate-100"
                }`}
              >
                {def && <span className="material-symbols-outlined text-sm">{def.icon}</span>}
                {s.category}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar md:grid md:grid-cols-4 lg:grid-cols-5 md:gap-4 md:overflow-visible md:pb-0">
        {current.listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={{ ...listing, createdAt: new Date(listing.createdAt) }}
          />
        ))}
      </div>
    </section>
  );
}

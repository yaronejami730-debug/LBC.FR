"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FilterBuilder from "./FilterBuilder";
import { CATEGORIES } from "@/lib/categories";

interface SavedSearch {
  id: string;
  name: string;
  filters: string;
  createdAt: string;
  matchCount: number;
}

interface Props {
  initialSearches: SavedSearch[];
}

function buildSearchUrl(filters: Record<string, string>): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) {
    // search page expects category label ("Véhicules"), not id ("vehicules")
    const cat = CATEGORIES.find((c) => c.id === filters.category);
    params.set("category", cat ? cat.label : filters.category);
  }
  // Pass all non-category, non-q filters so SearchBar picks them up
  const skip = new Set(["q", "category"]);
  for (const [k, v] of Object.entries(filters)) {
    if (!skip.has(k) && v) params.set(k, v);
  }
  // Signal to SearchBar to auto-open the filter panel
  params.set("_filters", "1");
  return `/search?${params.toString()}`;
}

function buildFilterChips(filters: Record<string, string>): string[] {
  const chips: string[] = [];
  const skip = new Set(["category"]);
  const labels: Record<string, string> = {
    q: "", minPrice: "", maxPrice: "", location: "",
    vehicleType: "", fuel: "", gearbox: "", minKm: "km min", maxKm: "km max",
    minYear: "De", maxYear: "À", propertyType: "", transactionType: "",
    minSurface: "m² min", maxSurface: "m² max", minRooms: "", maxRooms: "",
    deviceType: "", condition: "", size: "", contractType: "", experience: "",
    animalType: "", animalAge: "", childAge: "", accommodationType: "", capacity: "pers.",
    serviceType: "", communityType: "", sector: "",
  };

  if (filters.q) chips.push(`"${filters.q}"`);
  if (filters.location) chips.push(filters.location);
  if (filters.minPrice && filters.maxPrice) chips.push(`${Number(filters.minPrice).toLocaleString("fr-FR")} – ${Number(filters.maxPrice).toLocaleString("fr-FR")} €`);
  else if (filters.minPrice) chips.push(`Dès ${Number(filters.minPrice).toLocaleString("fr-FR")} €`);
  else if (filters.maxPrice) chips.push(`Max ${Number(filters.maxPrice).toLocaleString("fr-FR")} €`);

  for (const [k, v] of Object.entries(filters)) {
    if (!v || skip.has(k) || ["q", "location", "minPrice", "maxPrice"].includes(k)) continue;
    const suffix = labels[k] ? ` ${labels[k]}` : "";
    chips.push(`${v}${suffix}`);
  }

  return chips;
}

function SearchCard({ search, onDeleted }: { search: SavedSearch; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const filters = JSON.parse(search.filters) as Record<string, string>;
  const cat = CATEGORIES.find((c) => c.id === filters.category);
  const chips = buildFilterChips(filters);
  const url = buildSearchUrl(filters);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm("Supprimer cette recherche sauvegardée ?")) return;
    setDeleting(true);
    await fetch(`/api/saved-searches/${search.id}`, { method: "DELETE" });
    onDeleted();
  }

  return (
    <div className="bg-white rounded-2xl border border-surface-container shadow-[0_2px_12px_rgba(21,21,125,0.04)] hover:shadow-[0_4px_20px_rgba(21,21,125,0.08)] transition-shadow">
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Category icon */}
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              {cat?.icon || "search"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-on-surface text-sm font-['Manrope'] leading-tight">{search.name}</p>
            {cat && (
              <p className="text-xs text-primary font-semibold mt-0.5">{cat.label}</p>
            )}
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {chips.map((chip, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">{chip}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Match badge + delete */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            search.matchCount > 0
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-slate-100 text-slate-500"
          }`}>
            {search.matchCount > 0 ? `${search.matchCount} annonce${search.matchCount > 1 ? "s" : ""}` : "Aucune annonce"}
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors group"
          >
            <span className="material-symbols-outlined text-base text-slate-400 group-hover:text-red-500 transition-colors">
              {deleting ? "hourglass_empty" : "delete"}
            </span>
          </button>
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 pb-4">
        <Link
          href={url}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-sm shadow-primary/20 active:scale-[0.98] transition-transform"
        >
          <span className="material-symbols-outlined text-base">search</span>
          Voir les annonces
          {search.matchCount > 0 && (
            <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-xs font-bold">{search.matchCount}</span>
          )}
        </Link>
      </div>
    </div>
  );
}

export default function SearchesClient({ initialSearches }: Props) {
  const router = useRouter();
  const [searches, setSearches] = useState(initialSearches);
  const [showBuilder, setShowBuilder] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/saved-searches");
    if (res.ok) {
      const data = await res.json();
      setSearches(data);
    }
  }, []);

  function handleSaved() {
    setShowBuilder(false);
    refresh();
  }

  function handleDeleted() {
    refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-on-surface font-['Manrope']">Mes recherches</h1>
          <p className="text-outline text-sm mt-0.5">
            {searches.length} recherche{searches.length !== 1 ? "s" : ""} sauvegardée{searches.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowBuilder(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-full font-bold text-sm shadow-md shadow-primary/20 active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Créer
        </button>
      </div>

      {searches.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[0_2px_12px_rgba(21,21,125,0.05)]">
          <span className="material-symbols-outlined text-5xl text-outline/30 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>
            manage_search
          </span>
          <p className="text-on-surface-variant font-medium">Aucune recherche sauvegardée</p>
          <p className="text-outline text-sm mt-1">
            Créez des filtres personnalisés et retrouvez rapidement les annonces qui vous intéressent
          </p>
          <button
            onClick={() => setShowBuilder(true)}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-bold text-sm shadow-md shadow-primary/20 active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            Créer ma première recherche
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {searches.map((s) => (
            <SearchCard key={s.id} search={s} onDeleted={handleDeleted} />
          ))}

          {/* Create another button at the bottom */}
          <button
            onClick={() => setShowBuilder(true)}
            className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-2 font-semibold text-sm"
          >
            <span className="material-symbols-outlined text-xl">add_circle</span>
            Ajouter une recherche
          </button>
        </div>
      )}

      {showBuilder && (
        <FilterBuilder
          onClose={() => setShowBuilder(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

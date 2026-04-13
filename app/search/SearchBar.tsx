"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getFiltersForCategory, COMMON_FILTERS, type FilterField } from "@/lib/filters-config";
import { CATEGORIES } from "@/lib/categories";
import { detectCategory } from "@/lib/autoCategory";

interface Props {
  q: string;
  category: string;           // label as in URL, e.g. "Véhicules"
  searchParams: Record<string, string>;
}

// ─── Single filter input ──────────────────────────────────────────────────────
function FilterInput({
  field, value, onChange,
}: { field: FilterField; value: string; onChange: (k: string, v: string) => void }) {
  if (field.type === "select" && field.options) {
    return (
      <select value={value} onChange={(e) => onChange(field.key, e.target.value)}
        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary bg-white transition-colors appearance-none">
        <option value="">{field.emptyLabel ?? "Peu importe"}</option>
        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === "text") {
    return (
      <div className="flex items-center border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-primary transition-colors bg-white">
        <span className="material-symbols-outlined text-slate-300 text-[18px] mr-2">location_on</span>
        <input type="text" value={value} onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.label}
          className="flex-1 bg-transparent border-none focus:ring-0 text-sm outline-none" />
      </div>
    );
  }
  return (
    <div className="relative">
      <input type="number" value={value} min={field.min} max={field.max}
        onChange={(e) => onChange(field.key, e.target.value)} placeholder={field.label}
        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors pr-10 bg-white" />
      {field.unit && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{field.unit}</span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SearchBar({ q, category, searchParams }: Props) {
  const router = useRouter();

  // drawerCategory tracks the category selected INSIDE the drawer (by id)
  const [drawerCategory, setDrawerCategory] = useState<string>(() =>
    CATEGORIES.find((c) => c.label === category)?.id ?? ""
  );
  const [manualCategory, setManualCategory] = useState(!!category);

  // filter values (everything except category)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v = { ...searchParams };
    delete v._filters;
    delete v.category;
    return v;
  });

  // auto-detect badge text
  const [detected, setDetected] = useState<string | null>(null);

  // auto-open when coming from saved search
  const [open, setOpen] = useState(() => searchParams._filters === "1");

  // run auto-detect immediately when panel opens (if q already set and no manual category)
  function openPanel() {
    if (!manualCategory && (values.q || q)) {
      const kw = (values.q || q).trim();
      const result = detectCategory(kw);
      if (result && result.confidence > 0.3 && !drawerCategory) {
        setDrawerCategory(result.categoryId);
        const cat = CATEGORIES.find((c) => c.id === result.categoryId);
        setDetected(cat?.label ?? null);
      }
    }
    setOpen(true);
  }

  // clear category-specific values when category changes (skip first render)
  const isFirstCatChange = useRef(true);
  useEffect(() => {
    if (isFirstCatChange.current) { isFirstCatChange.current = false; return; }
    setValues((prev) => {
      const keep: Record<string, string> = {};
      if (prev.q) keep.q = prev.q;
      if (prev.minPrice) keep.minPrice = prev.minPrice;
      if (prev.maxPrice) keep.maxPrice = prev.maxPrice;
      if (prev.location) keep.location = prev.location;
      if (prev.sort) keep.sort = prev.sort;
      return keep;
    });
  }, [drawerCategory]);

  // auto-detect category from q
  useEffect(() => {
    const kw = values.q?.trim() || "";
    if (!kw || manualCategory) { setDetected(null); return; }
    const result = detectCategory(kw);
    if (result && result.confidence > 0.3) {
      setDrawerCategory(result.categoryId);
      const cat = CATEGORIES.find((c) => c.id === result.categoryId);
      setDetected(cat?.label ?? null);
    } else {
      setDetected(null);
      if (!manualCategory) setDrawerCategory("");
    }
  }, [values.q, manualCategory]);

  const setValue = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  function pickCategory(id: string) {
    if (drawerCategory === id) {
      setDrawerCategory("");
      setManualCategory(false);
    } else {
      setDrawerCategory(id);
      setManualCategory(true);
      setDetected(null);
    }
  }

  // filter groups for selected category
  const filterGroups = getFiltersForCategory(drawerCategory);

  // Only count explicit filter refinements — NOT q, NOT category
  // (a simple keyword search shouldn't light up the filter button)
  const SKIP = new Set(["q", "category", "page", "_filters", "sort"]);
  const activeCount = Object.entries(values).filter(([k, v]) => v && !SKIP.has(k)).length;

  function buildURL() {
    const params = new URLSearchParams();
    if (values.q) params.set("q", values.q);
    if (drawerCategory) {
      const cat = CATEGORIES.find((c) => c.id === drawerCategory);
      if (cat) params.set("category", cat.label);
    }
    Object.entries(values).forEach(([k, v]) => {
      if (v && !new Set(["q", "page", "_filters"]).has(k)) params.set(k, v);
    });
    return `/search?${params.toString()}`;
  }

  function apply() {
    router.push(buildURL());
    setOpen(false);
  }

  function reset() {
    setValues({});
    setDrawerCategory("");
    setManualCategory(false);
    setDetected(null);
    router.push("/search");
    setOpen(false);
  }

  const selectedCat = CATEGORIES.find((c) => c.id === drawerCategory);

  return (
    <>
      {/* ── Trigger row ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <form action="/search" method="get"
          className="flex items-center bg-surface-container-lowest px-4 py-2 rounded-xl shadow-[0_8px_24px_rgba(21,21,125,0.04)] w-full md:w-96 group">
          {category && <input type="hidden" name="category" value={category} />}
          <span className="material-symbols-outlined text-outline-variant group-focus-within:text-primary transition-colors">search</span>
          <input defaultValue={q} name="q" type="text" placeholder="Rechercher…"
            className="bg-transparent border-none focus:ring-0 text-sm w-full ml-2 outline-none" />
        </form>

        <button onClick={openPanel}
          className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition-all flex-shrink-0 shadow-[0_8px_24px_rgba(21,21,125,0.04)]
            ${open || activeCount > 0 ? "bg-primary text-white" : "bg-surface-container-lowest text-on-surface-variant hover:bg-slate-50"}`}>
          <span className="material-symbols-outlined text-[18px]">tune</span>
          <span className="hidden sm:inline">Filtres</span>
          {activeCount > 0 && (
            <span className="text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-white text-primary">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Drawer ──────────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative w-full sm:w-[440px] bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="font-black text-primary text-base">Filtres</h2>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  {selectedCat ? `Adaptés à : ${selectedCat.label}` : "Toutes catégories"}
                </p>
              </div>
              <button onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                <span className="material-symbols-outlined text-slate-500 text-[18px]">close</span>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

              {/* ── Mots-clés ── */}
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Mots-clés</p>
                <div className="flex items-center border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-primary transition-colors bg-white">
                  <span className="material-symbols-outlined text-slate-300 text-[18px] mr-2">search</span>
                  <input type="text" value={values.q || ""} onChange={(e) => setValue("q", e.target.value)}
                    placeholder="Marque, modèle, description…"
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm outline-none" />
                  {values.q && (
                    <button onClick={() => setValue("q", "")} className="ml-1 text-slate-400 hover:text-slate-600">
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  )}
                </div>
                {detected && (
                  <p className="text-[11px] text-primary font-semibold mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    Catégorie détectée : {detected}
                  </p>
                )}
              </div>

              {/* ── Catégorie ── */}
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Catégorie</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button key={cat.id} onClick={() => pickCategory(cat.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                        drawerCategory === cat.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-slate-200 hover:border-slate-300 text-on-surface"
                      }`}>
                      <span className="material-symbols-outlined text-base shrink-0"
                        style={drawerCategory === cat.id ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                        {cat.icon}
                      </span>
                      <span className="font-medium text-xs leading-tight">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Filtres dynamiques (catégorie-spécifiques + communs) ── */}
              {filterGroups.map((group) => {
                if (group.label === "Trier par") return null;
                return (
                  <div key={group.label}>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{group.label}</p>
                    {group.fields.length === 2 && (group.fields[0].type === "range" || group.fields[0].type === "number") ? (
                      <div className="grid grid-cols-2 gap-2">
                        {group.fields.map((f) => (
                          <FilterInput key={f.key} field={f} value={values[f.key] ?? ""} onChange={setValue} />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {group.fields.map((f) => (
                          <FilterInput key={f.key} field={f} value={values[f.key] ?? ""} onChange={setValue} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ── Trier par (toujours en dernier) ── */}
              {COMMON_FILTERS.filter(g => g.label === "Trier par").map((group) => (
                <div key="sort">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Trier par</p>
                  {group.fields.map((f) => (
                    <FilterInput key={f.key} field={f} value={values[f.key] ?? ""} onChange={setValue} />
                  ))}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-4 border-t border-slate-100 flex gap-3 bg-white rounded-b-3xl">
              <button onClick={reset}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors">
                Réinitialiser
              </button>
              <button onClick={apply}
                className="flex-[2] py-3 rounded-xl bg-primary text-white text-sm font-black shadow-md shadow-primary/20 active:scale-95 transition-transform">
                Voir les résultats
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getFiltersForCategory, type FilterField } from "@/lib/filters-config";
import { CATEGORIES } from "@/lib/categories";

interface Props {
  q: string;
  category: string;
  searchParams: Record<string, string>;
}

// ─── Single filter input ──────────────────────────────────────────────────────
function FilterInput({
  field,
  value,
  onChange,
}: {
  field: FilterField;
  value: string;
  onChange: (key: string, val: string) => void;
}) {
  if (field.type === "select" && field.options) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2f6fb8] bg-white transition-colors appearance-none"
      >
        <option value="">{field.emptyLabel ?? "Peu importe"}</option>
        {field.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (field.type === "text") {
    return (
      <div className="flex items-center border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-[#2f6fb8] transition-colors bg-white">
        <span className="material-symbols-outlined text-slate-300 text-[18px] mr-2">location_on</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.label}
          className="flex-1 bg-transparent border-none focus:ring-0 text-sm outline-none"
        />
      </div>
    );
  }

  // range or number
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        min={field.min}
        max={field.max}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.label}
        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#2f6fb8] transition-colors pr-10 bg-white"
      />
      {field.unit && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none">
          {field.unit}
        </span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SearchBar({ q, category, searchParams }: Props) {
  const router = useRouter();

  // Local state mirrors current URL params
  const [values, setValues] = useState<Record<string, string>>(searchParams);
  const [open, setOpen] = useState(false);

  // Reset category-specific filters when category changes, keep common ones
  useEffect(() => {
    setValues((prev) => {
      const next: Record<string, string> = {};
      if (prev.q) next.q = prev.q;
      if (prev.minPrice) next.minPrice = prev.minPrice;
      if (prev.maxPrice) next.maxPrice = prev.maxPrice;
      if (prev.location) next.location = prev.location;
      if (prev.sort) next.sort = prev.sort;
      return next;
    });
  }, [category]);

  const setValue = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const groups = getFiltersForCategory(
    CATEGORIES.find((c) => c.label === category)?.id ?? ""
  );

  // Count active non-search filters
  const activeCount = Object.entries(values).filter(
    ([k, v]) => v && k !== "q" && k !== "category" && k !== "page"
  ).length;

  function buildURL(overrides: Record<string, string> = {}) {
    const params = new URLSearchParams();
    const merged = { ...values, ...overrides };
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    Object.entries(merged).forEach(([k, v]) => {
      if (v && k !== "q" && k !== "category" && k !== "page") params.set(k, v);
    });
    return `/search?${params.toString()}`;
  }

  function apply() {
    router.push(buildURL());
    setOpen(false);
  }

  function reset() {
    setValues({});
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    router.push(`/search?${params.toString()}`);
    setOpen(false);
  }

  return (
    <>
      {/* ── Trigger row ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Search form */}
        <form
          action="/search"
          method="get"
          className="flex items-center bg-surface-container-lowest px-4 py-2 rounded-xl shadow-[0_8px_24px_rgba(21,21,125,0.04)] w-full md:w-96 group"
        >
          {category && <input type="hidden" name="category" value={category} />}
          <span className="material-symbols-outlined text-outline-variant group-focus-within:text-primary transition-colors">
            search
          </span>
          <input
            defaultValue={q}
            name="q"
            className="bg-transparent border-none focus:ring-0 text-sm w-full ml-2 outline-none"
            placeholder="Rechercher..."
            type="text"
          />
        </form>

        {/* Filter button */}
        <button
          onClick={() => setOpen(true)}
          className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition-all flex-shrink-0 shadow-[0_8px_24px_rgba(21,21,125,0.04)]
            ${open || activeCount > 0
              ? "bg-[#2f6fb8] text-white"
              : "bg-surface-container-lowest text-on-surface-variant hover:bg-slate-50"
            }`}
        >
          <span className="material-symbols-outlined text-[18px]">tune</span>
          <span className="hidden sm:inline">Filtres</span>
          {activeCount > 0 && (
            <span className={`text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0
              ${open || activeCount > 0 ? "bg-white text-[#2f6fb8]" : "bg-[#2f6fb8] text-white"}`}>
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Drawer overlay ──────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="relative w-full sm:w-[420px] bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h2 className="font-black text-[#2f6fb8] text-base">Filtres</h2>
                {category && (
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Adaptés à : <span className="font-bold text-slate-600">{category}</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-slate-500 text-[18px]">close</span>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                    {group.label}
                  </p>
                  {/* Range fields side by side */}
                  {group.fields.length === 2 && group.fields[0].type === "range" ? (
                    <div className="grid grid-cols-2 gap-2">
                      {group.fields.map((field) => (
                        <FilterInput
                          key={field.key}
                          field={field}
                          value={values[field.key] ?? ""}
                          onChange={setValue}
                        />
                      ))}
                    </div>
                  ) : group.fields.length === 2 && group.fields[0].type === "number" ? (
                    <div className="grid grid-cols-2 gap-2">
                      {group.fields.map((field) => (
                        <FilterInput
                          key={field.key}
                          field={field}
                          value={values[field.key] ?? ""}
                          onChange={setValue}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {group.fields.map((field) => (
                        <FilterInput
                          key={field.key}
                          field={field}
                          value={values[field.key] ?? ""}
                          onChange={setValue}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Sticky footer */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 flex gap-3 bg-white rounded-b-3xl">
              <button
                onClick={reset}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Réinitialiser
              </button>
              <button
                onClick={apply}
                className="flex-2 flex-[2] py-3 rounded-xl bg-[#2f6fb8] text-white text-sm font-black shadow-md shadow-[#2f6fb8]/20 active:scale-95 transition-transform"
              >
                Voir les résultats
                {activeCount > 0 && (
                  <span className="ml-2 bg-white/20 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    {activeCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

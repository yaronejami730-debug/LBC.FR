"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Suggestion {
  id: string;
  title: string;
  price: number;
  category: string;
  image: string | null;
}

interface SuggestResponse {
  listings: Suggestion[];
  categories: { name: string; count: number }[];
}

export default function NavSearch() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<SuggestResponse>({ listings: [], categories: [] });
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (value: string) => {
    if (value.length < 2) { setData({ listings: [], categories: [] }); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(value)}`);
      const json: SuggestResponse = await res.json();
      setData(json);
      setOpen(json.listings.length > 0 || json.categories.length > 0);
    } catch {
      setData({ listings: [], categories: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(value: string) {
    setQ(value);
    setActiveIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
  }

  function navigate(query: string) {
    setOpen(false);
    setQ(query);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = activeIdx >= 0 && activeIdx < data.listings.length
      ? data.listings[activeIdx].title
      : q;
    if (!query.trim()) return;
    navigate(query);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    const total = data.listings.length;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, total - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasResults = data.listings.length > 0 || data.categories.length > 0;

  return (
    <div ref={wrapRef} className="relative hidden md:flex flex-1 max-w-[640px]">
      <form
        onSubmit={handleSubmit}
        className={`flex flex-1 items-center bg-slate-100/80 hover:bg-slate-100 transition-colors rounded-full h-[44px] pl-4 pr-1.5 border ${
          focused ? "ring-2 ring-[#2f6fb8]/20 bg-white border-[#2f6fb8]/30" : "border-transparent"
        }`}
      >
        <input
          type="text"
          value={q}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { setFocused(true); if (hasResults) setOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher sur Deal & Co"
          className="flex-1 bg-transparent border-none outline-none text-[15px] text-slate-800 placeholder-slate-500 w-full"
          autoComplete="off"
        />
        {loading ? (
          <div className="w-[34px] h-[34px] flex items-center justify-center flex-shrink-0">
            <div className="w-4 h-4 border-2 border-[#2f6fb8] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <button
            type="submit"
            className="flex items-center justify-center w-[34px] h-[34px] bg-[#2f6fb8] text-white rounded-full hover:bg-[#1a5a9e] transition-colors flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
          </button>
        )}
      </form>

      {/* Dropdown */}
      {open && hasResults && (
        <div className="absolute top-[50px] left-0 right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[9999]">

          {/* Suggestions catégories */}
          {data.categories.length > 0 && (
            <div className="px-4 pt-3 pb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Catégories</p>
              <div className="flex flex-wrap gap-2 pb-2">
                {data.categories.map((cat) => (
                  <button
                    key={cat.name}
                    onMouseDown={() => router.push(`/search?category=${encodeURIComponent(cat.name)}&q=${encodeURIComponent(q)}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d5e3fc]/50 hover:bg-[#d5e3fc] text-[#2f6fb8] rounded-full text-xs font-semibold transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">category</span>
                    {cat.name}
                    <span className="text-[10px] opacity-60">({cat.count})</span>
                  </button>
                ))}
              </div>
              {data.listings.length > 0 && <div className="h-px bg-slate-50 mt-1" />}
            </div>
          )}

          {/* Annonces */}
          {data.listings.length > 0 && (
            <>
              <div className="px-4 pt-2 pb-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Annonces</p>
              </div>
              {data.listings.map((s, i) => (
                <button
                  key={s.id}
                  onMouseDown={() => navigate(s.title)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors ${
                    i === activeIdx ? "bg-slate-50" : ""
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                    {s.image ? (
                      <img src={s.image} alt={s.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-slate-300 flex items-center justify-center w-full h-full text-lg">image</span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">{s.title}</p>
                    <p className="text-[11px] text-slate-400">{s.category}</p>
                  </div>
                  {/* Prix */}
                  <span className="text-[13px] font-bold text-[#2f6fb8] flex-shrink-0">
                    {s.price.toLocaleString("fr-FR")} €
                  </span>
                </button>
              ))}
            </>
          )}

          {/* Footer — voir tous les résultats */}
          {q.trim().length >= 2 && (
            <button
              onMouseDown={() => navigate(q)}
              className="w-full flex items-center gap-2 px-4 py-3 border-t border-slate-50 text-[13px] font-semibold text-[#2f6fb8] hover:bg-[#d5e3fc]/30 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">search</span>
              Voir tous les résultats pour &laquo;&nbsp;{q}&nbsp;&raquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

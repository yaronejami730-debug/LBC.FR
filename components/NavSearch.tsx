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

const RECENT_KEY = "dealco_recent_searches";
const MAX_RECENT = 5;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecent(query: string) {
  try {
    const prev = loadRecent().filter((q) => q !== query);
    localStorage.setItem(RECENT_KEY, JSON.stringify([query, ...prev].slice(0, MAX_RECENT)));
  } catch {}
}

export default function NavSearch() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<SuggestResponse>({ listings: [], categories: [] });
  const [popular, setPopular] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Charger les recherches populaires une seule fois
  useEffect(() => {
    fetch("/api/search/popular")
      .then((r) => r.json())
      .then(setPopular)
      .catch(() => {});
  }, []);

  const fetchSuggestions = useCallback(async (value: string) => {
    if (value.length < 2) {
      setData({ listings: [], categories: [] });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(value)}`);
      const json: SuggestResponse = await res.json();
      setData(json);
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
    if (!query.trim()) return;
    saveRecent(query.trim());
    setRecent(loadRecent());
    setOpen(false);
    setQ(query.trim());
    // Log en DB — fire and forget
    fetch("/api/search/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.trim() }),
    }).catch(() => {});
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = activeIdx >= 0 && q.length >= 2 && activeIdx < data.listings.length
      ? data.listings[activeIdx].title
      : q;
    navigate(query);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    const total = data.listings.length;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, total - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  function handleFocus() {
    setFocused(true);
    setRecent(loadRecent());
    setOpen(true);
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showEmpty = q.length < 2;
  const hasAutoComplete = !showEmpty && (data.listings.length > 0 || data.categories.length > 0);
  const showDropdown = open && (showEmpty ? (recent.length > 0 || popular.length > 0) : hasAutoComplete);

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
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher une voiture, un meuble, un service…"
          className="flex-1 bg-transparent border-none outline-none text-[15px] text-slate-800 placeholder-slate-400 w-full"
          autoComplete="off"
        />
        {loading ? (
          <div className="w-[34px] h-[34px] flex items-center justify-center flex-shrink-0">
            <div className="w-4 h-4 border-2 border-[#2f6fb8] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <button type="submit" className="flex items-center justify-center w-[34px] h-[34px] bg-[#2f6fb8] text-white rounded-full hover:bg-[#1a5a9e] transition-colors flex-shrink-0">
            <span className="material-symbols-outlined text-[18px]">search</span>
          </button>
        )}
      </form>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-[50px] left-0 right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[9999]">

          {/* ── État vide : dernières recherches + populaires ── */}
          {showEmpty && (
            <>
              {recent.length > 0 && (
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dernières recherches</p>
                    <button
                      onMouseDown={() => {
                        try { localStorage.removeItem(RECENT_KEY); } catch {}
                        setRecent([]);
                      }}
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      Effacer
                    </button>
                  </div>
                  {recent.map((r) => (
                    <button
                      key={r}
                      onMouseDown={() => navigate(r)}
                      className="w-full flex items-center gap-3 py-2 text-left hover:bg-slate-50 rounded-lg px-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px] text-slate-400">history</span>
                      <span className="text-[14px] text-slate-700">{r}</span>
                    </button>
                  ))}
                </div>
              )}

              {popular.length > 0 && (
                <div className={`px-4 pb-4 ${recent.length > 0 ? "pt-1 border-t border-slate-50" : "pt-4"}`}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Recherches populaires</p>
                  <div className="flex flex-wrap gap-2">
                    {popular.map((p) => (
                      <button
                        key={p}
                        onMouseDown={() => navigate(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-[#d5e3fc]/60 text-slate-700 hover:text-[#2f6fb8] rounded-full text-[12px] font-medium transition-colors border border-slate-100"
                      >
                        <span className="material-symbols-outlined text-[13px] text-slate-400">trending_up</span>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Autocomplétion ── */}
          {!showEmpty && (
            <>
              {data.categories.length > 0 && (
                <div className="px-4 pt-3 pb-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Catégories</p>
                  <div className="flex flex-wrap gap-2 pb-1">
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
                  {data.listings.length > 0 && <div className="h-px bg-slate-50 mt-2" />}
                </div>
              )}

              {data.listings.length > 0 && (
                <>
                  <div className="px-4 pt-2 pb-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Annonces</p>
                  </div>
                  {data.listings.map((s, i) => (
                    <button
                      key={s.id}
                      onMouseDown={() => navigate(s.title)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors ${i === activeIdx ? "bg-slate-50" : ""}`}
                    >
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                        {s.image
                          ? <img src={s.image} alt={s.title} className="w-full h-full object-cover" />
                          : <span className="material-symbols-outlined text-slate-300 flex items-center justify-center w-full h-full text-lg">image</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-slate-800 truncate">{s.title}</p>
                        <p className="text-[11px] text-slate-400">{s.category}</p>
                      </div>
                      <span className="text-[13px] font-bold text-[#2f6fb8] flex-shrink-0">
                        {s.price.toLocaleString("fr-FR")} €
                      </span>
                    </button>
                  ))}
                </>
              )}

              <button
                onMouseDown={() => navigate(q)}
                className="w-full flex items-center gap-2 px-4 py-3 border-t border-slate-50 text-[13px] font-semibold text-[#2f6fb8] hover:bg-[#d5e3fc]/30 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">search</span>
                Voir tous les résultats pour &laquo;&nbsp;{q}&nbsp;&raquo;
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

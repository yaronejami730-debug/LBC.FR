"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Suggestion {
  id: string;
  title: string;
  price: number;
  category: string;
}

export default function NavSearch() {
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (value: string) => {
    if (value.length < 2) { setSuggestions([]); setOpen(false); return; }
    try {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(value)}`);
      const data: Suggestion[] = await res.json();
      setSuggestions(data);
      setOpen(data.length > 0);
    } catch {
      setSuggestions([]);
    }
  }, []);

  function handleChange(value: string) {
    setQ(value);
    setActiveIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 200);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = activeIdx >= 0 ? suggestions[activeIdx].title : q;
    if (!query.trim()) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  function handleSelect(title: string) {
    setQ(title);
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(title)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
          onFocus={() => { setFocused(true); if (suggestions.length > 0) setOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher sur Deal & Co"
          className="flex-1 bg-transparent border-none outline-none text-[15px] text-slate-800 placeholder-slate-500 w-full"
          autoComplete="off"
        />
        <button
          type="submit"
          className="flex items-center justify-center w-[34px] h-[34px] bg-[#2f6fb8] text-white rounded-full hover:bg-[#2f6fb8]/90 transition-colors flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">search</span>
        </button>
      </form>

      {/* Dropdown suggestions */}
      {open && suggestions.length > 0 && (
        <div className="absolute top-[48px] left-0 right-0 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-[9999]">
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              onMouseDown={() => handleSelect(s.title)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${
                i === activeIdx ? "bg-slate-50" : ""
              }`}
            >
              <span className="material-symbols-outlined text-[18px] text-slate-400 flex-shrink-0">search</span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-slate-800 truncate">{s.title}</p>
                <p className="text-[11px] text-slate-400">{s.category}</p>
              </div>
              <span className="text-[13px] font-bold text-[#2f6fb8] flex-shrink-0">
                {s.price.toLocaleString("fr-FR")} €
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

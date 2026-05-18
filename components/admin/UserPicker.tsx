"use client";

import { useEffect, useRef, useState } from "react";
import { searchUsersForSourcePicker } from "@/app/admin/actions";

export type UserOption = {
  id: string;
  email: string;
  name: string;
  isPro: boolean;
  companyName: string | null;
};

/** Affichage : nom commercial pour les pros, nom perso sinon. */
export function userDisplayName(u: UserOption): string {
  return u.isPro && u.companyName ? u.companyName : u.name;
}

/**
 * Sélecteur de compte utilisateur — recherche live (email / nom / société),
 * debounce 250 ms. Le compte choisi est exposé via `onSelect`.
 */
export default function UserPicker({
  selected,
  onSelect,
}: {
  selected: UserOption | null;
  onSelect: (u: UserOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchUsersForSourcePicker(query));
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, selected]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (selected) {
    return (
      <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-xl border border-[#eceef0] bg-[#f7f9fb]">
        <span className="material-symbols-outlined text-[18px] text-[#2f6fb8]">
          {selected.isPro ? "storefront" : "person"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#191c1e] truncate">
            {userDisplayName(selected)}
          </p>
          <p className="text-[11px] text-[#777683] truncate">{selected.email}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQuery("");
            setResults([]);
          }}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#777683] hover:bg-white hover:text-[#ba1a1a]"
          title="Changer de compte"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative mt-1.5" ref={boxRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Rechercher par email, nom ou société…"
        autoComplete="off"
        className="w-full px-4 py-2.5 rounded-xl border border-[#eceef0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30"
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-[#eceef0] rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {searching && <div className="px-4 py-3 text-xs text-[#777683]">Recherche…</div>}
          {!searching && results.length === 0 && (
            <div className="px-4 py-3 text-xs text-[#777683]">Aucun compte trouvé.</div>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onSelect(u);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-[#f7f9fb] flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-[18px] text-[#777683]">
                {u.isPro ? "storefront" : "person"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#191c1e] truncate">
                  {userDisplayName(u)}
                </p>
                <p className="text-[11px] text-[#777683] truncate">{u.email}</p>
              </div>
              {u.isPro && (
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#e1e0ff] text-[#2f6fb8]">
                  Pro
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

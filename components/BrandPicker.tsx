"use client";

import { useState } from "react";
import { CAR_BRANDS } from "@/lib/carBrands";

export default function BrandPicker({
  value,
  onChange,
  inputCls,
}: {
  value: string;
  onChange: (name: string) => void;
  inputCls?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = search.trim()
    ? CAR_BRANDS.filter((b) =>
        b.name.toLowerCase().includes(search.toLowerCase())
      )
    : CAR_BRANDS;

  const selected = CAR_BRANDS.find(
    (b) => b.name.toLowerCase() === value.toLowerCase()
  );

  function select(name: string) {
    onChange(name);
    setSearch("");
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      {/* Selected brand badge */}
      {selected && !open && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/5 cursor-pointer"
          onClick={() => setOpen(true)}
        >
          <BrandLogo src={selected.logo} name={selected.name} size={32} />
          <span className="font-bold text-on-surface">{selected.name}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="ml-auto text-outline hover:text-red-500 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Open picker button */}
      {!selected && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            inputCls
              ? inputCls + " flex items-center gap-2 text-left"
              : "w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-sm text-outline flex items-center gap-2 hover:border-primary/40 transition-all"
          }
        >
          <span className="material-symbols-outlined text-[20px]">directions_car</span>
          Choisir une marque…
        </button>
      )}

      {/* Picker panel */}
      {open && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400 text-[20px]">search</span>
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une marque…"
              className="flex-1 text-sm outline-none text-on-surface placeholder:text-outline/50"
            />
            <button type="button" onClick={() => { setOpen(false); setSearch(""); }}>
              <span className="material-symbols-outlined text-slate-400 text-[20px] hover:text-slate-600">close</span>
            </button>
          </div>

          {/* Grid of logos */}
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1 p-3 max-h-72 overflow-y-auto">
            {filtered.map((brand) => {
              const isActive = brand.name.toLowerCase() === value.toLowerCase();
              return (
                <button
                  key={brand.name}
                  type="button"
                  onClick={() => select(brand.name)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all hover:bg-slate-50 active:scale-95 ${
                    isActive ? "bg-primary/10 ring-2 ring-primary/30" : ""
                  }`}
                >
                  <BrandLogo src={brand.logo} name={brand.name} size={36} />
                  <span className="text-[9px] font-semibold text-slate-600 text-center leading-tight line-clamp-2">
                    {brand.name}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full py-6 text-center text-sm text-outline">
                Aucune marque trouvée —{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => { onChange(search); setOpen(false); setSearch(""); }}
                >
                  utiliser &quot;{search}&quot;
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Logo image with text-initial fallback */
export function BrandLogo({
  src,
  name,
  size = 40,
}: {
  src: string;
  name: string;
  size?: number;
}) {
  const [err, setErr] = useState(false);

  if (err) {
    return (
      <div
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        className="rounded-lg bg-slate-100 flex items-center justify-center font-black text-slate-500 shrink-0"
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      onError={() => setErr(true)}
      className="object-contain rounded-lg shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";

export default function CategoryDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="mr-3 p-2 rounded-full hover:bg-slate-100 transition-colors text-[#2f6fb8] active:scale-95"
        aria-label="Menu des catégories"
      >
        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 0, 'wght' 600" }}>menu</span>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-[100dvh] w-[85vw] max-w-sm bg-white z-[101] shadow-2xl transition-transform duration-300 ease-out transform overflow-hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full bg-white">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-[#2f6fb8] tracking-tight">Catégories</h2>
              <p className="text-xs text-slate-400 font-medium">Parcourez nos univers</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-slate-400">close</span>
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto py-4 px-2 no-scrollbar">
            <div className="grid grid-cols-1 gap-1">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/search?category=${encodeURIComponent(cat.label)}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-2xl hover:bg-slate-50 transition-all group active:scale-[0.98]"
                >
                  <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-2xl">{cat.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[#2f6fb8] text-[15px]">{cat.label}</p>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                      {cat.subcategories.slice(0, 3).join(", ")}...
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-slate-200 text-base">chevron_right</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-slate-50 border-t border-slate-100">
            <Link 
              href="/post" 
              onClick={() => setIsOpen(false)}
              className="w-full py-4 bg-[#2f6fb8] text-white rounded-2xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-[#2f6fb8]/20 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Déposer une annonce
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

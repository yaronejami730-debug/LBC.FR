"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type SwitcherEstablishment = {
  id: string;
  name: string;
  city: string | null;
  isPublished: boolean;
};

/**
 * Sélecteur de boutique.
 *
 * Ne s'affiche qu'à partir de deux établissements : un indépendant ne doit
 * jamais voir la mécanique multi-boutiques. C'est l'exigence — la structure
 * doit être disponible, pas imposée.
 *
 * Le choix est écrit dans un cookie (la boutique reste ouverte d'une page à
 * l'autre) *et* poussé dans l'URL via `?etab=`. Le cookie seul rendrait les
 * liens intransmissibles : un responsable qui envoie l'agenda de Neuilly à son
 * associé lui ouvrirait Paris.
 */
export default function EstablishmentSwitcher({
  establishments,
  activeId,
}: {
  establishments: SwitcherEstablishment[];
  activeId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (establishments.length < 2) return null;

  const active = establishments.find((e) => e.id === activeId) ?? establishments[0];

  function select(id: string) {
    // 180 jours : le pro ne rechoisit pas sa boutique à chaque session.
    document.cookie = `activeEstablishment=${id}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
    setOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("etab", id);
    router.push(url.pathname + url.search);
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="w-full sm:w-auto inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-left hover:border-primary transition-colors"
      >
        <span className="material-symbols-outlined text-[20px] text-primary">storefront</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-outline">
            Établissement
          </span>
          <span className="block text-sm font-bold truncate">
            {active.name}
            {active.city && <span className="text-outline font-medium"> · {active.city}</span>}
          </span>
        </span>
        <span className="material-symbols-outlined text-[20px] text-outline">expand_more</span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-40 mt-1 w-full sm:w-80 rounded-xl bg-white border border-slate-200 shadow-lg overflow-hidden"
        >
          {establishments.map((e) => (
            <button
              key={e.id}
              type="button"
              role="option"
              aria-selected={e.id === active.id}
              onClick={() => select(e.id)}
              className={`w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-surface-container-low ${
                e.id === active.id ? "bg-primary/5" : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold truncate">{e.name}</span>
                <span className="block text-xs text-outline">
                  {e.city ?? "Adresse à compléter"}
                  {!e.isPublished && " · non publiée"}
                </span>
              </span>
              {e.id === active.id && (
                <span className="material-symbols-outlined text-[18px] text-primary">check</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

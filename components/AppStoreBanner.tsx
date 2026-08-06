"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "dealandco.appbanner.dismissed";

/**
 * Bandeau "Bientôt disponible sur l'App Store".
 *
 * Posé en `fixed` en bas d'écran, jamais dans le flux : monté après
 * hydratation (localStorage), il poussait toute la page vers le bas au
 * chargement — l'essentiel du CLS de l'accueil. Hors flux, il n'en produit
 * plus. `bottom-24` sur mobile pour passer au-dessus de la barre de
 * navigation. Non affiché sur les routes admin.
 */
export function AppStoreBanner() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY) === "1";
      if (!dismissed && !window.location.pathname.startsWith("/admin")) {
        setHidden(false);
      }
    } catch {}
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setHidden(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-24 md:bottom-4 z-[190] px-3 pointer-events-none">
      <div className="pointer-events-auto max-w-3xl mx-auto rounded-full shadow-lg bg-gradient-to-r from-[#2f6fb8] to-[#1e4e8a] text-white text-sm px-4 py-2 flex items-center gap-3">
        <span className="text-base" aria-hidden>📱</span>
        <p className="flex-1 leading-tight">
          <span className="font-bold">Deal&Co bientôt disponible</span> sur l'App Store iOS et Google Play.
        </p>
        <a
          href="#"
          className="hidden sm:inline-block bg-white/15 hover:bg-white/25 px-3 py-1 rounded-full text-xs font-bold transition"
          onClick={(e) => { e.preventDefault(); }}
        >
          M'avertir
        </a>
        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="w-7 h-7 flex items-center justify-center hover:bg-white/15 rounded-full transition"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Emplacement publicitaire branché sur Deal&Co Ads.
 *
 * Trois règles, et elles expliquent tout le composant :
 *
 *  - **l'impression n'est comptée qu'à l'apparition réelle à l'écran.** Un
 *    encart rendu en bas de page mais jamais atteint n'est pas une publicité
 *    vue, et un annonceur n'a pas à la payer. D'où `IntersectionObserver`
 *    plutôt qu'un compteur au montage ;
 *  - **le client ne décide de rien.** Il envoie son contexte, il reçoit une
 *    publicité et un jeton. La destination du clic est relue côté serveur ;
 *  - **sans campagne éligible, l'emplacement disparaît.** Pas de cadre vide,
 *    pas de « publicité à venir ».
 */

type ServedAd = {
  adId: string;
  title: string;
  description: string;
  imageUrl: string;
  imageUrlWide: string | null;
  ctaLabel: string;
  token: string;
};

/** Identifiant d'affichage : anonyme, éphémère, jamais lié à un compte. */
function sessionId(): string {
  const KEY = "dco_ad_session";
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;
    const fresh = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Navigation privée ou stockage refusé : on reste anonyme, la
    // déduplication se fera sur cette valeur volatile.
    return "anon-" + Math.random().toString(36).slice(2);
  }
}

export default function AdSlot({
  placement,
  city,
  category,
  className,
  fallback,
}: {
  placement: string;
  city?: string | null;
  category?: string | null;
  className?: string;
  /** Affiché quand aucune campagne n'est éligible — les bannières maison. */
  fallback?: React.ReactNode;
}) {
  const [ad, setAd] = useState<ServedAd | null>(null);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ads/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placement, city, category, platform: "WEB" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setAd(data.ad ?? null);
          setLoaded(true);
        }
      })
      .catch(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [placement, city, category]);

  // Impression : au premier moment où l'encart est réellement visible.
  useEffect(() => {
    if (!ad || !ref.current || seen.current) return;
    const node = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5);
        if (!visible || seen.current) return;
        seen.current = true;
        observer.disconnect();
        fetch("/api/ads/impression", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: ad.token, sessionId: sessionId() }),
          keepalive: true,
        }).catch(() => {});
      },
      { threshold: [0.5] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ad]);

  const click = useCallback(async () => {
    if (!ad) return;
    try {
      const res = await fetch("/api/ads/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: ad.token, sessionId: sessionId() }),
      });
      const data = await res.json().catch(() => ({}));
      // La destination vient du serveur : un lien fabriqué côté client
      // enverrait les visiteurs n'importe où sous couvert de publicité.
      if (data.destination) window.open(data.destination, "_blank", "noopener,noreferrer");
    } catch {
      /* un clic perdu ne doit pas casser la page */
    }
  }, [ad]);

  if (!loaded) return null;
  if (!ad) return <>{fallback ?? null}</>;

  return (
    <div ref={ref} className={className}>
      <button
        type="button"
        onClick={click}
        className="block w-full text-left rounded-2xl border border-slate-100 bg-white overflow-hidden hover:border-primary/40 transition-colors"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ad.imageUrlWide ?? ad.imageUrl}
          alt=""
          className="w-full aspect-[16/9] object-cover bg-surface-container-low"
        />
        <span className="block p-4">
          <span className="block font-bold">{ad.title}</span>
          <span className="block text-sm text-outline mt-0.5 line-clamp-2">{ad.description}</span>
          <span className="mt-3 inline-block rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white">
            {ad.ctaLabel}
          </span>
          <span className="mt-2 block text-[10px] font-bold uppercase tracking-wider text-outline">
            Sponsorisé
          </span>
        </span>
      </button>
    </div>
  );
}

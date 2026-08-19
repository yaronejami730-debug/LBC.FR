"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isAdFreePath } from "@/lib/ads/placements";
import { getTopCategories } from "@/lib/search-history";
import { currentPageViewId, sendAdEvent, watchViewability } from "@/lib/ads/client-tracking";
import { rememberAdClick } from "@/lib/ads/conversion-client";

/**
 * Emplacement publicitaire branché sur Deal&Co Ads.
 *
 * Trois règles, et elles expliquent tout le composant :
 *
 *  - **l'impression n'est comptée qu'à l'apparition réelle à l'écran, et
 *    tenue.** Un encart rendu en bas de page mais jamais atteint n'est pas une
 *    publicité vue ; un encart traversé au scroll en trois dixièmes de seconde
 *    non plus. Il faut la moitié du bloc à l'écran pendant une seconde cumulée,
 *    onglet au premier plan. Le chargement et le rendu sont remontés à part,
 *    sans jamais être facturés : ils disent quelle part de l'inventaire
 *    n'atteint jamais l'écran ;
 *  - **le client ne décide de rien.** Il envoie son contexte, il reçoit une
 *    publicité et un jeton. La destination du clic est relue côté serveur ;
 *  - **sans campagne éligible, l'emplacement disparaît.** Pas de cadre vide,
 *    pas de « publicité à venir ».
 *
 * Trois habillages, un seul mécanisme : `strip` — le défaut — pour une ligne
 * discrète, `card` pour se fondre dans une grille d'annonces, `banner` pour un
 * bandeau à grande image. La mesure et la facturation sont identiques dans les
 * trois cas, seul le HTML change.
 *
 * Le défaut est délibérément le plus petit. Un bandeau à visuel 16/9 posé entre
 * deux rayons de l'accueil mange un écran de téléphone entier et fait passer la
 * place de marché au second plan : la publicité doit accompagner le site, pas
 * l'occuper. Le format large ne sert que là où la page est longue et respirée —
 * le dépôt d'annonce.
 */

type ServedAd = {
  adId: string;
  title: string;
  description: string;
  imageUrl: string;
  imageUrlWide: string | null;
  ctaLabel: string;
  /** Absent sur une bannière maison : rien à mesurer, donc rien à signer. */
  token?: string | null;
  /** Vrai quand l'encart vient de nos propres bannières, pas d'un annonceur. */
  house?: boolean;
  destinationUrl?: string | null;
};

/**
 * Créatifs déjà affichés sur cette page.
 *
 * Partagé entre tous les encarts d'un même rendu : le deuxième à demander sait
 * ce que le premier montre, et le serveur peut lui proposer autre chose. Vidé
 * naturellement au changement de page, puisque le module est réévalué.
 *
 * Ce n'est qu'une indication : avec un seul annonceur, le serveur resservira le
 * même créatif plutôt que de laisser un trou.
 */
const shown = new Set<string>();

/** Historique local, sans jamais faire tomber un encart pour si peu. */
function safeTopCategories(): string[] {
  try {
    return getTopCategories(3);
  } catch {
    return [];
  }
}

export default function AdSlot({
  placement,
  city,
  category,
  className,
  fallback,
  variant = "strip",
  size = "sm",
}: {
  placement: string;
  city?: string | null;
  category?: string | null;
  className?: string;
  /** Affiché quand aucune campagne n'est éligible — les bannières maison. */
  fallback?: React.ReactNode;
  variant?: "banner" | "card" | "strip";
  /** Taille de la ligne `strip`. `md` reste discret, à peine plus haut. */
  size?: "sm" | "md";
}) {
  const pathname = usePathname();
  const adFree = isAdFreePath(pathname);
  const [ad, setAd] = useState<ServedAd | null>(null);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);
  // Un identifiant par chargement de page, partagé par tous les encarts : c'est
  // l'unité de déduplication côté serveur.
  const pageViewId = currentPageViewId(pathname);

  useEffect(() => {
    if (adFree) return;
    let cancelled = false;
    fetch("/api/ads/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Catégories récemment parcourues : elles vivent dans le navigateur, le
      // serveur ne les a pas. C'est ce qui permet de proposer un vendeur
      // d'ordinateurs à quelqu'un qui en cherche, plutôt qu'au hasard.
      body: JSON.stringify({
        placement,
        city,
        category,
        platform: "WEB",
        recentCategories: safeTopCategories(),
        excludeAdIds: [...shown],
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          // Une campagne d'abord ; à défaut, la bannière maison renvoyée par le
          // serveur. L'encart n'est vide que si les deux manquent.
          const served = data.ad ?? data.house ?? null;
          if (served?.adId) shown.add(served.adId);
          setAd(served);
          setLoaded(true);
        }
      })
      .catch(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [placement, city, category, adFree]);

  // Chargement : la publicité est arrivée dans le client. Jamais facturé —
  // c'est le dénominateur qui dira quelle part de l'inventaire atteint l'écran.
  useEffect(() => {
    if (!ad?.token) return;
    void sendAdEvent({ type: "LOAD", token: ad.token, pageViewId });
  }, [ad, pageViewId]);

  // Rendu, puis visibilité réelle. Le rendu est immédiat : le nœud est dans la
  // page. La visibilité, elle, se mérite — la moitié du bloc, une seconde.
  useEffect(() => {
    if (!ad?.token || !ref.current || seen.current) return;
    const node = ref.current;
    const token = ad.token;

    void sendAdEvent({ type: "RENDER", token, pageViewId });

    const watcher = watchViewability(node, ({ viewportPct, visibleMs }) => {
      if (seen.current) return;
      seen.current = true;
      void sendAdEvent({
        type: "VIEWABLE_IMPRESSION",
        token,
        pageViewId,
        viewportPct,
        visibleMs,
      });
    });

    return () => watcher.disconnect();
  }, [ad, pageViewId]);

  const click = useCallback(async () => {
    if (!ad) return;
    if (!ad.token) {
      // Bannière maison : la destination est publique et connue, il n'y a ni
      // budget à protéger ni clic à facturer.
      if (ad.destinationUrl) window.open(ad.destinationUrl, "_blank", "noopener,noreferrer");
      return;
    }
    // La destination vient du serveur : un lien fabriqué côté client enverrait
    // les visiteurs n'importe où sous couvert de publicité. Un clic écarté par
    // l'anti-fraude ouvre quand même la destination — la personne a le droit
    // d'arriver, c'est la facture qui change.
    // Le clic est mémorisé avant l'ouverture : le nouvel onglet hérite d'une
    // copie du stockage de session, et pourra rattacher un appel ou un message
    // à cette publicité plutôt qu'au hasard.
    rememberAdClick(ad.token, ad.adId);
    const data = await sendAdEvent({ type: "CLICK", token: ad.token, pageViewId });
    if (data?.destination) window.open(data.destination, "_blank", "noopener,noreferrer");
  }, [ad, pageViewId]);

  // Surface sans publicité : ni campagne, ni bannière maison. La règle vaut
  // pour tout ce qui passe par ce composant, y compris un encart ajouté plus
  // tard sans y penser.
  if (adFree) return null;
  if (!loaded) return null;

  if (!ad) {
    if (fallback) return <>{fallback}</>;
    /* En développement, un emplacement sans inventaire se signale au lieu de
       disparaître : sinon rien ne distingue « aucune campagne » d'un encart
       oublié ou d'une requête en échec. Jamais en production. */
    if (process.env.NODE_ENV !== "production") {
      return (
        <div
          className={`rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center ${className ?? ""}`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Emplacement {placement}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Aucune campagne éligible et aucune bannière maison active.
          </p>
        </div>
      );
    }
    return null;
  }

  // Une bannière maison remplace le repli fourni par la page : les deux jouent
  // le même rôle, en montrer deux ferait doublon.
  if (ad.house && fallback) return <>{fallback}</>;

  if (variant === "card") {
    return (
      <div ref={ref} className={className}>
        <button
          type="button"
          onClick={click}
          className="group flex w-full flex-col overflow-hidden rounded-xl border border-[#c7c5d4] bg-white text-left transition-all hover:shadow-md"
        >
          <span className="relative block aspect-square overflow-hidden bg-surface-container-low">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ad.imageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <span className="absolute left-2 top-2 rounded-full bg-[#2f6fb8] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
              Publicité
            </span>
          </span>
          <span className="flex flex-col gap-0.5 p-2.5">
            <span className="line-clamp-2 text-sm font-semibold leading-snug text-on-surface">{ad.title}</span>
            <span className="line-clamp-2 text-xs text-outline">{ad.description}</span>
          </span>
        </button>
      </div>
    );
  }

  if (variant === "strip") {
    return (
      <div ref={ref} className={className}>
        <button
          type="button"
          onClick={click}
          className={`flex w-full items-center gap-3 rounded-2xl border border-[#2f6fb8]/25 bg-[#eef4fb] text-left shadow-sm transition-colors hover:border-[#2f6fb8]/60 hover:bg-[#e6eff9] ${
            size === "md" ? "p-4" : "p-3"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ad.imageUrl}
            alt=""
            className={`shrink-0 rounded-xl border border-white object-cover bg-white ${
              size === "md" ? "h-20 w-20" : "h-12 w-12"
            }`}
          />
          <span className="min-w-0 flex-1">
            <span className="inline-block rounded-full bg-[#2f6fb8] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              Sponsorisé
            </span>
            <span
              className={`mt-1 block truncate font-bold text-slate-900 ${
                size === "md" ? "text-base" : "text-sm"
              }`}
            >
              {ad.title}
            </span>
            <span
              className={`block text-xs text-slate-500 ${size === "md" ? "line-clamp-2" : "truncate"}`}
            >
              {ad.description}
            </span>
            {size === "md" && (
              <span className="mt-2 inline-block rounded-full bg-[#2f6fb8] px-3 py-1 text-[11px] font-bold text-white">
                {ad.ctaLabel}
              </span>
            )}
          </span>
          <span className="material-symbols-outlined shrink-0 text-[20px] text-[#2f6fb8]">
            chevron_right
          </span>
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className={className}>
      <button
        type="button"
        onClick={click}
        className="block w-full overflow-hidden rounded-2xl border border-[#2f6fb8]/25 bg-white text-left shadow-sm transition-colors hover:border-[#2f6fb8]/60"
      >
        <span className="relative block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ad.imageUrlWide ?? ad.imageUrl}
            alt=""
            className="w-full aspect-[16/9] object-cover bg-surface-container-low"
          />
          {/* Sur l'image, pas sous le texte : la mention doit se lire avant le
              message, pas après l'avoir pris pour un contenu du site. */}
          <span className="absolute left-3 top-3 rounded-full bg-[#2f6fb8] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow">
            Sponsorisé
          </span>
        </span>
        <span className="block bg-[#eef4fb] p-4">
          <span className="block font-bold text-slate-900">{ad.title}</span>
          <span className="mt-0.5 block text-sm text-slate-600 line-clamp-2">{ad.description}</span>
          <span className="mt-3 inline-block rounded-full bg-[#2f6fb8] px-4 py-1.5 text-xs font-bold text-white">
            {ad.ctaLabel}
          </span>
        </span>
      </button>
    </div>
  );
}

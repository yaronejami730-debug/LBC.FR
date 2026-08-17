"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

/**
 * Mes annonces — la vue d'un vendeur sur son propre stock.
 *
 * La grille de vignettes carrées du profil montrait la photo et pas grand-chose
 * d'autre : pour savoir ce qui attendait une validation, il fallait lire des
 * pastilles de neuf pixels posées sur l'image. Ici la ligne est horizontale, ce
 * qui laisse la place au seul renseignement qu'on vient chercher — **où en est
 * cette annonce** — sans sacrifier la photo, qui reste ce à quoi on reconnaît
 * son annonce du premier coup d'œil.
 *
 * Le filtre porte sur l'état plutôt que sur la date : un vendeur cherche « ce
 * qui coince », pas « ce que j'ai publié en mars ».
 */

export type MyListing = {
  id: string;
  title: string;
  price: number;
  location: string;
  createdAt: string;
  images: string;
  status: string;
  isPremium: boolean;
  viewCount: number;
  rejectionReason?: string | null;
  permanentDeletionAt?: string | null;
};

/** État affiché : libellé, teinte, et ordre de gravité. */
const STATES: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "En ligne", className: "bg-[#e8f5ee] text-[#0f6b45]" },
  PENDING: { label: "En validation", className: "bg-amber-50 text-amber-700" },
  UNDER_REVIEW: { label: "À corriger", className: "bg-amber-100 text-amber-800" },
  REJECTED: { label: "Refusée", className: "bg-red-50 text-red-700" },
  REMOVED: { label: "Retirée", className: "bg-red-100 text-red-700" },
  SOLD: { label: "Vendue", className: "bg-slate-100 text-slate-600" },
  EXPIRED: { label: "Expirée", className: "bg-slate-100 text-slate-600" },
};

const FILTERS = [
  { key: "all", label: "Toutes" },
  { key: "ACTIVE", label: "En ligne" },
  { key: "PENDING", label: "En validation" },
  { key: "problem", label: "À corriger" },
] as const;

/**
 * Jours restants avant destruction définitive.
 *
 * Recalculé ici plutôt qu'importé de `lib/moderation/removal`, qui tire Prisma
 * et le SDK Blob avec lui — rien de tout cela n'a sa place dans un bundle
 * navigateur.
 */
function daysLeft(at: string | null | undefined): number | null {
  if (!at) return null;
  const ms = new Date(at).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

function firstImage(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as string[];
    return parsed[0] || null;
  } catch {
    return null;
  }
}

const euros = (n: number) => `${n.toLocaleString("fr-FR")} €`;

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export default function MyListings({ listings }: { listings: MyListing[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const counts = useMemo(
    () => ({
      all: listings.length,
      ACTIVE: listings.filter((l) => l.status === "ACTIVE").length,
      PENDING: listings.filter((l) => l.status === "PENDING").length,
      problem: listings.filter((l) =>
        ["UNDER_REVIEW", "REJECTED", "REMOVED"].includes(l.status),
      ).length,
    }),
    [listings],
  );

  const visible = useMemo(() => {
    if (filter === "all") return listings;
    if (filter === "problem")
      return listings.filter((l) => ["UNDER_REVIEW", "REJECTED", "REMOVED"].includes(l.status));
    return listings.filter((l) => l.status === filter);
  }, [listings, filter]);

  const totalViews = listings.reduce((sum, l) => sum + l.viewCount, 0);

  return (
    <div>
      {/* Trois chiffres, pas un tableau de bord : ce qui est visible, ce qui
          attend, et l'attention reçue. */}
      <div className="grid grid-cols-3 gap-3">
        <Stat value={counts.ACTIVE} label="en ligne" tone="text-[#0f6b45]" />
        <Stat value={counts.PENDING} label="en validation" tone="text-amber-700" />
        <Stat value={totalViews} label="vues au total" tone="text-[#2f6fb8]" />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const n = counts[f.key];
          // Un filtre qui ne mène nulle part n'est pas proposé : « À corriger (0) »
          // inquiète pour rien.
          if (n === 0 && f.key !== "all") return null;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                active
                  ? "bg-[#2f6fb8] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-[#2f6fb8] hover:text-[#2f6fb8]"
              }`}
            >
              {f.label}
              <span className={active ? "ml-1.5 text-white/70" : "ml-1.5 text-slate-400"}>{n}</span>
            </button>
          );
        })}
      </div>

      <ul className="mt-5 space-y-3">
        {visible.map((listing) => {
          const img = firstImage(listing.images);
          const state = STATES[listing.status] ?? {
            label: listing.status,
            className: "bg-slate-100 text-slate-600",
          };
          const left = daysLeft(listing.permanentDeletionAt);

          return (
            <li key={listing.id}>
              <Link
                href={`/annonce/${listing.id}`}
                className="group flex gap-4 rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_2px_12px_rgba(21,21,125,0.04)] transition-all hover:border-[#2f6fb8]/40 hover:shadow-[0_6px_20px_rgba(21,21,125,0.08)]"
              >
                <span className="relative block h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-surface-container-low sm:h-28 sm:w-28">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      <span className="material-symbols-outlined text-3xl text-outline/30">image</span>
                    </span>
                  )}
                  {listing.isPremium && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-secondary-container px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-on-secondary-container">
                      Premium
                    </span>
                  )}
                </span>

                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 font-bold leading-snug text-on-surface">
                      {listing.title}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${state.className}`}
                    >
                      {state.label}
                    </span>
                  </span>

                  <span className="mt-1 text-lg font-extrabold tabular-nums text-[#2f6fb8]">
                    {euros(listing.price)}
                  </span>

                  <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-outline">
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">location_on</span>
                      <span className="truncate">{listing.location}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <span className="material-symbols-outlined text-[14px]">visibility</span>
                      {listing.viewCount}
                    </span>
                    <span className="tabular-nums">{day(listing.createdAt)}</span>
                  </span>
                </span>
              </Link>

              {/* Ce qui bloque est dit sous la carte, en toutes lettres : une
                  pastille « Refusée » sans motif oblige à écrire au support. */}
              {listing.status === "UNDER_REVIEW" && listing.rejectionReason && (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-bold text-amber-900">À corriger avant remise en ligne</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-amber-900/90">
                    {listing.rejectionReason}
                  </p>
                </div>
              )}

              {(listing.status === "REJECTED" || listing.status === "REMOVED") && left !== null && (
                <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  {listing.rejectionReason && (
                    <p className="text-xs leading-relaxed text-red-800">{listing.rejectionReason}</p>
                  )}
                  <p className="mt-1 text-xs font-bold text-red-700">
                    {left === 0
                      ? "Suppression définitive imminente"
                      : `Suppression définitive dans ${left} jour${left > 1 ? "s" : ""}`}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {visible.length === 0 && (
        <p className="mt-6 rounded-2xl bg-white px-4 py-10 text-center text-sm text-outline">
          Aucune annonce dans cet état.
        </p>
      )}
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-center">
      <p className={`text-2xl font-extrabold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-outline">
        {label}
      </p>
    </div>
  );
}

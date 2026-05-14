import Link from "next/link";
import { prisma } from "@/lib/prisma";

interface Props {
  listingId: string;
  marque: string;
  modele: string;
  currentPrice: number;
}

interface Verdict {
  label: string;
  tone: "good" | "neutral" | "bad";
  icon: string;
}

function classify(current: number, avg: number): Verdict {
  const delta = (current - avg) / avg;
  if (delta <= -0.10) return { label: "Bonne affaire potentielle", tone: "good", icon: "trending_down" };
  if (delta <= -0.03) return { label: "Sous le prix moyen", tone: "good", icon: "thumb_up" };
  if (delta >= 0.15) return { label: "Au-dessus du marché", tone: "bad", icon: "trending_up" };
  if (delta >= 0.05) return { label: "Légèrement au-dessus du marché", tone: "neutral", icon: "info" };
  return { label: "Dans la moyenne du marché", tone: "neutral", icon: "balance" };
}

export default async function MarketEstimate({ listingId, marque, modele, currentPrice }: Props) {
  const agg = await prisma.listing
    .aggregate({
      where: {
        id: { not: listingId },
        status: "APPROVED",
        shadowBanned: false,
        deletedAt: null,
        category: "Véhicules",
        price: { gt: 0 },
        metadata: { contains: modele, mode: "insensitive" },
      } as any,
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true },
      _count: { _all: true },
    })
    .catch(() => null);

  if (!agg || agg._count._all < 3 || !agg._avg.price) return null;

  const count = agg._count._all;
  const avg = Math.round(agg._avg.price);
  const min = Math.round(agg._min.price ?? 0);
  const max = Math.round(agg._max.price ?? 0);
  const verdict = classify(currentPrice, avg);

  const toneClass =
    verdict.tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-100"
      : verdict.tone === "bad"
      ? "bg-rose-50 text-rose-800 border-rose-100"
      : "bg-slate-50 text-slate-700 border-slate-200";

  const range = max - min;
  const pos = range > 0 ? Math.max(0, Math.min(1, (currentPrice - min) / range)) : 0.5;

  const priceSlug = `${marque}-${modele}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return (
    <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_8px_24px_rgba(21,21,125,0.04)]">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-extrabold tracking-tight text-on-surface font-['Manrope']">
          Cote marché — {marque} {modele}
        </h2>
        <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          query_stats
        </span>
      </div>
      <p className="text-xs text-outline mb-5">
        Basé sur {count.toLocaleString("fr-FR")} annonce{count > 1 ? "s" : ""} actives Deal&amp;Co similaires.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="Min" value={`${min.toLocaleString("fr-FR")} €`} />
        <Stat label="Moyen" value={`${avg.toLocaleString("fr-FR")} €`} highlight />
        <Stat label="Max" value={`${max.toLocaleString("fr-FR")} €`} />
      </div>

      <div className="relative h-2 rounded-full bg-slate-100 mb-3">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary ring-2 ring-white shadow"
          style={{ left: `calc(${pos * 100}% - 6px)` }}
          aria-label="Position de cette annonce"
        />
      </div>

      <div className={`flex items-start gap-3 rounded-xl border p-3 mb-4 ${toneClass}`}>
        <span className="material-symbols-outlined text-[20px] leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>
          {verdict.icon}
        </span>
        <div className="text-sm leading-snug">
          <strong className="font-bold">{verdict.label}</strong> — {currentPrice.toLocaleString("fr-FR")} € vs moyenne marché {avg.toLocaleString("fr-FR")} €
          {currentPrice !== avg && (
            <> ({currentPrice > avg ? "+" : ""}{Math.round(((currentPrice - avg) / avg) * 100)}%)</>
          )}
          .
        </div>
      </div>

      <Link
        href={`/prix/${priceSlug}-occasion`}
        className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
      >
        Voir prix marché {marque} {modele} d&apos;occasion
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </Link>
    </section>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-xl text-center ${highlight ? "bg-primary/10" : "bg-slate-50"}`}>
      <div className="text-[10px] uppercase tracking-widest text-outline font-semibold">{label}</div>
      <div className={`font-bold mt-0.5 ${highlight ? "text-primary text-base" : "text-sm text-on-surface"}`}>
        {value}
      </div>
    </div>
  );
}

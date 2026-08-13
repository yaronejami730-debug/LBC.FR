import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  computePriceSignal,
  MIN_VEHICLE_COMPARABLES,
  type Comparable,
} from "@/lib/market/price-signal";
import { getIndexablePriceSlugs } from "@/lib/seo/price";

interface Props {
  listingId: string;
  marque: string;
  modele: string;
  currentPrice: number;
  km?: number | null;
}

/**
 * Cote marché d'un véhicule.
 *
 * Le bloc ne s'affiche qu'à partir de MIN_VEHICLE_COMPARABLES annonces
 * comparables : en dessous, « bonne affaire » n'est qu'une moyenne sur trois
 * vendeurs. Le prix attendu suit le kilométrage quand les comparables le
 * renseignent (cf. lib/market/price-signal).
 */
export default async function MarketEstimate({ listingId, marque, modele, currentPrice, km }: Props) {
  const rows = await prisma.listing
    .findMany({
      where: {
        id: { not: listingId },
        status: "APPROVED",
        shadowBanned: false,
        deletedAt: null,
        category: "Véhicules",
        price: { gt: 0 },
        metadata: { contains: modele, mode: "insensitive" },
      } as any,
      select: { price: true, vehicleKm: true },
      take: 500,
    })
    .catch(() => null);

  if (!rows || rows.length < MIN_VEHICLE_COMPARABLES) return null;

  const comparables: Comparable[] = rows.map((r) => ({ price: r.price, km: r.vehicleKm }));
  const signal = computePriceSignal({
    price: currentPrice,
    isVehicle: true,
    km,
    comparables,
  });
  if (!signal) return null;

  const prices = comparables.map((c) => c.price).sort((a, b) => a - b);
  const min = Math.round(prices[0]);
  const max = Math.round(prices[prices.length - 1]);
  const count = signal.count;
  const expected = signal.expected;

  const toneClass =
    signal.tone === "great" || signal.tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-100"
      : signal.tone === "high"
      ? "bg-rose-50 text-rose-800 border-rose-100"
      : "bg-slate-50 text-slate-700 border-slate-200";

  const range = max - min;
  const pos = range > 0 ? Math.max(0, Math.min(1, (currentPrice - min) / range)) : 0.5;

  // Le lien vers la cote n'est émis que si la page existe réellement : le slug
  // était forgé à la volée depuis la marque et le modèle de l'annonce, sans
  // aucune garantie que `/prix/{slug}-occasion` ait de quoi répondre. Sur des
  // centaines de fiches annonce, cela fait autant de 404 potentielles offertes
  // au crawl.
  const priceSlug = `${marque}-${modele}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const quoteExists = await getIndexablePriceSlugs()
    .then((slugs) => slugs.includes(`${priceSlug}-occasion`))
    .catch(() => false);

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
        Basé sur {count.toLocaleString("fr-FR")} annonces actives Deal&amp;Co similaires
        {signal.basis === "km" ? ", à kilométrage comparable" : ""}.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="Min" value={`${min.toLocaleString("fr-FR")} €`} />
        <Stat
          label={signal.basis === "km" ? "Attendu" : "Médian"}
          value={`${expected.toLocaleString("fr-FR")} €`}
          highlight
        />
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
          {signal.icon}
        </span>
        <div className="text-sm leading-snug">
          <strong className="font-bold">{signal.label}</strong> — {currentPrice.toLocaleString("fr-FR")} € vs{" "}
          {signal.basis === "km" ? "prix attendu" : "prix médian"} {expected.toLocaleString("fr-FR")} €
          {signal.deltaPct !== 0 && (
            <> ({signal.deltaPct > 0 ? "+" : ""}{signal.deltaPct}%)</>
          )}
          .
        </div>
      </div>

      {quoteExists && (
        <Link
          href={`/prix/${priceSlug}-occasion`}
          className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
        >
          Voir prix marché {marque} {modele} d&apos;occasion
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      )}
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

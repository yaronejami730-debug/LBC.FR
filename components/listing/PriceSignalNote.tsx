import { prisma } from "@/lib/prisma";
import {
  computePriceSignal,
  MIN_GENERIC_COMPARABLES,
  type Comparable,
} from "@/lib/market/price-signal";

interface Props {
  listingId: string;
  category: string;
  subcategory: string | null;
  brand: string | null;
  currentPrice: number;
}

/**
 * Mention « Bonne affaire » hors véhicule.
 *
 * Ne dit jamais qu'un prix est trop élevé : hors véhicule, deux annonces de la
 * même sous-catégorie ne décrivent pas forcément le même objet (cf.
 * lib/market/price-signal). Et rien ne s'affiche sous
 * MIN_GENERIC_COMPARABLES annonces comparables.
 *
 * La sous-catégorie est obligatoire : comparer un prix à toute la catégorie
 * « Maison » ne veut rien dire.
 */
export default async function PriceSignalNote({
  listingId,
  category,
  subcategory,
  brand,
  currentPrice,
}: Props) {
  if (!subcategory) return null;

  const base = {
    id: { not: listingId },
    status: "APPROVED",
    shadowBanned: false,
    deletedAt: null,
    category,
    subcategory,
    price: { gt: 0 },
  };

  // La marque d'abord — un iPhone ne se compare pas à un téléphone générique.
  // On élargit à la sous-catégorie seulement si la marque ne fournit pas assez
  // d'annonces pour un verdict.
  let rows = brand
    ? await prisma.listing
        .findMany({ where: { ...base, brand } as any, select: { price: true }, take: 500 })
        .catch(() => [])
    : [];

  if (rows.length < MIN_GENERIC_COMPARABLES) {
    rows = await prisma.listing
      .findMany({ where: base as any, select: { price: true }, take: 500 })
      .catch(() => []);
  }

  if (rows.length < MIN_GENERIC_COMPARABLES) return null;

  const comparables: Comparable[] = rows.map((r) => ({ price: r.price }));
  const signal = computePriceSignal({ price: currentPrice, isVehicle: false, comparables });
  if (!signal) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
      <span
        className="material-symbols-outlined text-[22px] leading-none"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {signal.icon}
      </span>
      <div className="text-sm leading-snug">
        <strong className="font-bold">{signal.label}</strong> — {Math.abs(signal.deltaPct)} % sous le
        prix médian des {signal.count.toLocaleString("fr-FR")} annonces {subcategory.toLowerCase()}{" "}
        comparables ({signal.expected.toLocaleString("fr-FR")} €).
      </div>
    </div>
  );
}

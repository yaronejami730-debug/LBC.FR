import { prisma } from "@/lib/prisma";
import { PLACEMENTS, placementsBySurface } from "@/lib/ads/placements";
import {
  SMART_SUGGESTION_THRESHOLD,
  activeAdvertiserCount,
  smartSuggestionsEnabled,
} from "@/lib/ads/settings";
import DiffusionSettings, { type PlacementRow } from "./DiffusionSettings";

export const metadata = { title: "Diffusion — Deal&Co Ads" };
export const dynamic = "force-dynamic";

/**
 * Inventaire et mode de diffusion.
 *
 * Un seul écran répond aux deux questions qu'on se pose en exploitant une
 * régie : *où* passe la publicité, et *comment* on choisit laquelle. Le reste
 * — campagnes, annonceurs — a ses propres écrans.
 */
export default async function AdminDiffusionPage() {
  const [pricing, smart, advertisers, served] = await Promise.all([
    prisma.adPlacementPricing.findMany(),
    smartSuggestionsEnabled(),
    activeAdvertiserCount(),
    prisma.adEvent.groupBy({
      by: ["placement"],
      _count: { _all: true },
      where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    }),
  ]);

  const byPlacement = new Map(pricing.map((p) => [p.placement, p]));
  const counts = new Map(served.map((r) => [r.placement, r._count._all]));

  const rows: PlacementRow[] = PLACEMENTS.map((p) => ({
    key: p.key,
    label: p.label,
    surface: p.surface,
    description: p.description,
    format: p.format,
    platform: p.platform,
    model: byPlacement.get(p.key)?.model ?? "CPC",
    priceCents: byPlacement.get(p.key)?.priceCents ?? 0,
    // Sans ligne tarifaire, l'emplacement serait servi gratuitement : mieux
    // vaut le signaler que le laisser tourner.
    priced: byPlacement.has(p.key),
    isOpen: byPlacement.get(p.key)?.isOpen ?? true,
    events30d: counts.get(p.key) ?? 0,
  }));

  const surfaces = placementsBySurface().map((g) => g.surface);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2f6fb8]">Publicité</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Diffusion</h1>
        <p className="mt-1 text-sm text-slate-500">
          Les emplacements ouverts à la vente, leur tarif, et la façon dont le moteur choisit une
          campagne parmi celles qui sont éligibles.
        </p>
      </header>

      <DiffusionSettings
        rows={rows}
        surfaces={surfaces}
        smartEnabled={smart}
        advertisers={advertisers}
        threshold={SMART_SUGGESTION_THRESHOLD}
      />
    </div>
  );
}

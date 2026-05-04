import { prisma } from "@/lib/prisma";

type Props = {
  cityName?: string;
  categoryLabel?: string;
  subcategoryLabel?: string;
};

export default async function SearchInterestProof({
  cityName,
  categoryLabel,
  subcategoryLabel,
}: Props) {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [totalSearches, scopedSearches, weeklyVisitors] = await Promise.all([
    prisma.searchLog.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    cityName || categoryLabel || subcategoryLabel
      ? prisma.searchLog.count({
          where: {
            createdAt: { gte: since },
            OR: [
              cityName ? { query: { contains: cityName, mode: "insensitive" } } : undefined,
              categoryLabel ? { query: { contains: categoryLabel, mode: "insensitive" } } : undefined,
              subcategoryLabel ? { query: { contains: subcategoryLabel, mode: "insensitive" } } : undefined,
            ].filter(Boolean) as any,
          },
        }).catch(() => 0)
      : Promise.resolve(0),
    prisma.searchLog
      .findMany({ where: { createdAt: { gte: since } }, select: { id: true }, take: 1 })
      .then((r) => r.length)
      .catch(() => 0),
  ]);

  if (totalSearches < 5 && scopedSearches < 1) return null;

  const segment = subcategoryLabel ?? categoryLabel;
  const scopeLabel = [segment, cityName].filter(Boolean).join(" à ");

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
      <div className="flex items-center justify-center gap-2 text-amber-900 font-bold text-sm">
        <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
          trending_up
        </span>
        {scopedSearches > 0 && scopeLabel ? (
          <span>
            {scopedSearches.toLocaleString("fr-FR")} recherche{scopedSearches > 1 ? "s" : ""} pour{" "}
            <span className="font-extrabold">{scopeLabel}</span> ces 30 derniers jours
          </span>
        ) : (
          <span>
            {totalSearches.toLocaleString("fr-FR")} recherche{totalSearches > 1 ? "s" : ""} sur Deal&amp;Co ces 30 derniers jours
          </span>
        )}
      </div>
      <p className="text-xs text-amber-800/80 mt-1">
        Des acheteurs cherchent en ce moment — votre annonce sera vue.
      </p>
    </div>
  );
}

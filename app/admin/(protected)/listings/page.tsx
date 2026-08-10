import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ListingActions from "@/components/admin/ListingActions";
import PendingReasonButton from "@/components/admin/PendingReasonButton";
import { formatDistanceToNow } from "@/lib/utils";
import TimeLeftBadge from "@/components/admin/TimeLeftBadge";

// « Refusée » et « retirée » ne disent pas la même chose : la première n'a
// jamais été publiée, la seconde a été enlevée après coup. Les confondre dans
// un seul onglet empêchait de voir ce qui avait réellement circulé sur le site.
const STATUS_OPTIONS = [
  { value: "APPROVED", label: "En ligne", icon: "check_circle", color: "text-emerald-600 bg-emerald-50" },
  { value: "REJECTED", label: "Refusées", icon: "remove_circle", color: "text-[#ba1a1a] bg-[#fff8f7]" },
  { value: "REMOVED", label: "Retirées", icon: "visibility_off", color: "text-rose-700 bg-rose-50" },
  { value: "PENDING",  label: "En attente", icon: "pending_actions", color: "text-amber-600 bg-amber-50" },
];

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "APPROVED" } = await searchParams;

  // Refusées et retirées portent toutes deux un motif : la colonne s'affiche
  // pour les deux, sinon elle disparaîtrait là où elle est la plus utile.
  const showsReason = status === "REJECTED" || status === "REMOVED";
  // Seules les annonces en ligne courent vers leur retrait automatique.
  const showsExpiry = status === "APPROVED";
  const emptyLabel =
    status === "APPROVED"
      ? "en ligne"
      : status === "REJECTED"
        ? "refusée"
        : status === "REMOVED"
          ? "retirée"
          : "en attente";

  const [listings, counts] = await Promise.all([
    prisma.listing.findMany({
      where: { status, deletedAt: null },
      orderBy: status === "PENDING"
        ? [{ reviewPriority: "desc" }, { createdAt: "desc" }]
        : { createdAt: "desc" },
      include: { user: { select: { name: true, email: true, verified: true } } },
    }),
    Promise.all(
      STATUS_OPTIONS.map((s) => prisma.listing.count({ where: { status: s.value, deletedAt: null } }))
    ),
  ]);

  const countsMap = Object.fromEntries(STATUS_OPTIONS.map((s, i) => [s.value, counts[i]]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#191c1e] font-headline">Annonces</h1>
        <p className="text-sm text-[#777683] mt-1">Toutes les annonces sont publiées automatiquement. Retirez celles qui ne sont pas conformes.</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-white border border-[#eceef0] p-1.5 rounded-2xl w-full md:w-fit overflow-x-auto no-scrollbar">
        {STATUS_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={`/admin/listings?status=${opt.value}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
              status === opt.value
                ? "bg-[#2f6fb8] text-white shadow-sm"
                : "text-[#464652] hover:bg-[#f2f4f6]"
            }`}
          >
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ fontVariationSettings: status === opt.value ? "'FILL' 1" : "'FILL' 0" }}
            >
              {opt.icon}
            </span>
            {opt.label}
            <span
              className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                status === opt.value ? "bg-white/20 text-white" : opt.color
              }`}
            >
              {countsMap[opt.value]}
            </span>
          </Link>
        ))}
      </div>

      {/* Liste — cartes en dessous de md, tableau au-delà : sept colonnes ne
          tiennent pas sur un téléphone, et un tableau qui défile latéralement
          se manipule mal au pouce. */}
      <div className="md:hidden space-y-3">
        {listings.map((listing) => {
          const images = (() => {
            try { return JSON.parse(listing.images) as string[]; }
            catch { return [] as string[]; }
          })();
          const img = images[0] || "";

          return (
            <div key={listing.id} className="bg-white rounded-2xl border border-[#eceef0] p-4">
              <div className="flex gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#f2f4f6] flex-shrink-0">
                  {img ? (
                    <img src={img} alt={listing.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-[#777683] flex items-center justify-center w-full h-full text-xl">image</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#191c1e] line-clamp-2">{listing.title}</p>
                  <p className="text-sm font-extrabold text-[#2f6fb8] mt-0.5">
                    {listing.price.toLocaleString("fr-FR")} €
                  </p>
                  <p className="text-xs text-[#777683] mt-0.5 line-clamp-1">{listing.location}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#777683]">
                <span className="bg-[#f2f4f6] text-[#464652] px-2.5 py-1 rounded-full font-medium">
                  {listing.category}
                </span>
                <span>{formatDistanceToNow(listing.createdAt)}</span>
                {showsExpiry && <TimeLeftBadge createdAt={listing.createdAt} />}
                <span className="truncate max-w-full">{listing.user.name}</span>
              </div>

              {showsReason && listing.rejectionReason && (
                <p className="mt-2 text-xs italic text-[#777683]">{listing.rejectionReason}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href={`/annonce/${listing.id}`}
                  target="_blank"
                  title={`Voir « ${listing.title} »`}
                  className="text-xs font-bold text-[#2f6fb8] hover:underline flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  Voir
                </Link>
                {(listing.adminNote || listing.flagsJson !== "[]") && (
                  <PendingReasonButton
                    title={listing.title}
                    adminNote={listing.adminNote}
                    flagsJson={listing.flagsJson}
                    riskScore={listing.riskScore}
                    riskDecision={listing.riskDecision}
                    reviewPriority={listing.reviewPriority}
                  />
                )}
              </div>

              <div className="mt-3">
                <ListingActions listingId={listing.id} status={listing.status} />
              </div>
            </div>
          );
        })}

        {listings.length === 0 && (
          <p className="bg-white border border-[#eceef0] rounded-2xl py-10 text-center text-[#777683]">
            Aucune annonce{" "}
            {emptyLabel}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f2f4f6] bg-[#f7f9fb]">
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-6 py-3">Annonce</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Auteur</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Catégorie</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Prix</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Date</th>
                {/* L'échéance n'a de sens que pour ce qui est réellement en ligne. */}
                {showsExpiry && (
                  <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Expire dans</th>
                )}
                {showsReason && (
                  <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Motif</th>
                )}
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3 min-w-52">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f4f6]">
              {listings.map((listing) => {
                const images = (() => {
                  try { return JSON.parse(listing.images) as string[]; }
                  catch { return [] as string[]; }
                })();
                const img = images[0] || "";

                return (
                  <tr key={listing.id} className="hover:bg-[#f7f9fb] transition-colors">
                    {/* Listing */}
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#f2f4f6] flex-shrink-0">
                          {img ? (
                            <img src={img} alt={listing.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-[#777683] flex items-center justify-center w-full h-full text-xl">image</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#191c1e] line-clamp-1 max-w-[220px]">{listing.title}</p>
                          <p className="text-xs text-[#777683] mt-0.5 line-clamp-1 max-w-[220px]">{listing.location}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                            <Link
                              href={`/annonce/${listing.id}`}
                              target="_blank"
                              className="text-[10px] text-[#2f6fb8] hover:underline flex items-center gap-0.5"
                            >
                              <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                              Voir
                            </Link>
                            {(listing.adminNote || listing.flagsJson !== "[]") && (
                              <PendingReasonButton
                                title={listing.title}
                                adminNote={listing.adminNote}
                                flagsJson={listing.flagsJson}
                                riskScore={listing.riskScore}
                                riskDecision={listing.riskDecision}
                                reviewPriority={listing.reviewPriority}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Author */}
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium text-[#191c1e]">{listing.user.name}</span>
                          {listing.user.verified && (
                            <span className="material-symbols-outlined text-[12px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                          )}
                        </div>
                        <span className="text-xs text-[#777683]">{listing.user.email}</span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      <span className="text-xs bg-[#f2f4f6] text-[#464652] px-2.5 py-1 rounded-full font-medium">
                        {listing.category}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-[#2f6fb8]">
                        {listing.price.toLocaleString("fr-FR")} €
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-[#777683] whitespace-nowrap">
                        {formatDistanceToNow(listing.createdAt)}
                      </span>
                    </td>

                    {/* Temps restant avant retrait automatique */}
                    {showsExpiry && (
                      <td className="px-4 py-3">
                        <TimeLeftBadge createdAt={listing.createdAt} />
                      </td>
                    )}

                    {/* Motif — onglets « refusées » et « retirées » */}
                    {showsReason && (
                      <td className="px-4 py-3 max-w-[180px]">
                        <span className="text-xs text-[#777683] italic line-clamp-2">
                          {listing.rejectionReason || "—"}
                        </span>
                      </td>
                    )}

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <ListingActions listingId={listing.id} status={listing.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {listings.length === 0 && (
          <div className="py-16 text-center">
            <span
              className="material-symbols-outlined text-5xl text-[#c7c5d4]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {STATUS_OPTIONS.find((s) => s.value === status)?.icon ?? "list_alt"}
            </span>
            <p className="text-[#777683] mt-2">
              Aucune annonce{" "}
              {emptyLabel}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SERVICE_ICONS, SERVICE_LABELS, SERVICE_TYPES, euros, unitLabel } from "@/lib/pet/services";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trouver un pet-sitter près de chez vous",
  description: "Recherchez un pet-sitter de confiance pour la garde ou la promenade de votre animal.",
};

export default async function PetSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; ville?: string }>;
}) {
  const sp = await searchParams;
  const service = SERVICE_TYPES.includes(sp.service as never) ? sp.service! : undefined;
  const ville = (sp.ville ?? "").trim();

  const offerings = await prisma.petServiceOffering.findMany({
    where: {
      isActive: true,
      ...(service ? { serviceType: service } : {}),
      proService: {
        isPublished: true,
        kycCompletedAt: { not: null },
        ...(ville ? { city: { contains: ville, mode: "insensitive" } } : {}),
      },
    },
    include: {
      proService: {
        select: { displayName: true, slug: true, city: true, avgRating: true, reviewCount: true, photos: true, isVerified: true },
      },
    },
    orderBy: [{ proService: { avgRating: "desc" } }, { createdAt: "desc" }],
    take: 60,
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-extrabold font-['Manrope'] mb-1">
        {service ? SERVICE_LABELS[service] : "Tous les pet-sitters"}
      </h1>
      <p className="text-slate-600 mb-6">
        {offerings.length} prestation{offerings.length > 1 ? "s" : ""} disponible{offerings.length > 1 ? "s" : ""}
        {ville ? ` à ${ville}` : ""}
      </p>

      <form className="flex flex-wrap gap-3 mb-8 bg-white border border-slate-200 rounded-2xl p-4">
        <select
          name="service"
          defaultValue={service ?? ""}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Tous les services</option>
          {SERVICE_TYPES.map((t) => (
            <option key={t} value={t}>
              {SERVICE_LABELS[t]}
            </option>
          ))}
        </select>
        <input
          name="ville"
          defaultValue={ville}
          placeholder="Ville"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]"
        />
        <button
          type="submit"
          className="bg-[#2f6fb8] hover:bg-[#2560a0] text-white px-5 py-2 rounded-full font-bold text-sm transition-colors"
        >
          Rechercher
        </button>
      </form>

      {offerings.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 48 }}>pets</span>
          <p className="mt-2">Aucun pet-sitter pour ces critères.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {offerings.map((o) => {
            const photos = JSON.parse(o.proService.photos || "[]") as string[];
            return (
              <Link
                key={o.id}
                href={`/pet/pro/${o.proService.slug}`}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-[#2f6fb8] hover:shadow-md transition-all"
              >
                <div className="h-40 bg-slate-100 flex items-center justify-center">
                  {photos[0] ? (
                    <img src={photos[0]} alt={o.proService.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 48 }}>pets</span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-1 text-xs text-[#2f6fb8] font-bold uppercase tracking-wider mb-1">
                    <span className="material-symbols-outlined text-[14px]">{SERVICE_ICONS[o.serviceType]}</span>
                    {SERVICE_LABELS[o.serviceType]}
                  </div>
                  <h3 className="font-bold font-['Manrope'] truncate">{o.title}</h3>
                  <div className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                    {o.proService.displayName}
                    {o.proService.isVerified && (
                      <span className="material-symbols-outlined text-emerald-600 text-[14px]">verified</span>
                    )}
                    · {o.proService.city}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-extrabold text-[#2f6fb8]">
                      {euros(o.priceCents)} € <span className="text-xs font-medium text-slate-500">/ {unitLabel(o.unit)}</span>
                    </span>
                    {o.proService.reviewCount > 0 && (
                      <span className="text-xs text-slate-500 flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-amber-400 text-[14px]">star</span>
                        {o.proService.avgRating?.toFixed(1)} ({o.proService.reviewCount})
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

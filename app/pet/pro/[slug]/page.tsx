import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SERVICE_ICONS, SERVICE_LABELS, euros, unitLabel } from "@/lib/pet/services";

export const dynamic = "force-dynamic";

async function getPro(slug: string) {
  return prisma.petProService.findUnique({
    where: { slug },
    include: {
      offerings: { where: { isActive: true }, orderBy: { createdAt: "desc" } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { author: { select: { name: true } } },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pro = await getPro(slug);
  if (!pro) return { title: "Pet-sitter introuvable" };
  return {
    title: `${pro.displayName} — Pet-sitter à ${pro.city}`,
    description: pro.bio.slice(0, 160),
  };
}

export default async function ProProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pro = await getPro(slug);
  if (!pro || !pro.isPublished) notFound();

  const photos = JSON.parse(pro.photos || "[]") as string[];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-6">
        <div className="h-52 bg-slate-100 flex items-center justify-center">
          {photos[0] ? (
            <img src={photos[0]} alt={pro.displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 64 }}>pets</span>
          )}
        </div>
        <div className="p-6">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-extrabold font-['Manrope']">{pro.displayName}</h1>
            {pro.isVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                Vérifié
              </span>
            )}
            {pro.kycCompletedAt && (
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-[#2f6fb8]/10 text-[#2f6fb8] px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[14px]">lock</span>
                Identité confirmée
              </span>
            )}
          </div>
          <div className="text-slate-600 mt-1 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">location_on</span>
              {pro.city}
            </span>
            {pro.reviewCount > 0 && (
              <span className="flex items-center gap-0.5">
                <span className="material-symbols-outlined text-amber-400 text-[16px]">star</span>
                {pro.avgRating?.toFixed(1)} · {pro.reviewCount} avis
              </span>
            )}
          </div>
          <p className="text-slate-700 mt-4 whitespace-pre-line leading-relaxed">{pro.bio}</p>
        </div>
      </div>

      <h2 className="text-xl font-bold font-['Manrope'] mb-3">Prestations</h2>
      {pro.offerings.length === 0 ? (
        <p className="text-slate-500 text-sm mb-8">Aucune prestation disponible pour l&apos;instant.</p>
      ) : (
        <div className="space-y-3 mb-8">
          {pro.offerings.map((o) => (
            <div
              key={o.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-1 text-xs text-[#2f6fb8] font-bold uppercase tracking-wider mb-1">
                  <span className="material-symbols-outlined text-[14px]">{SERVICE_ICONS[o.serviceType]}</span>
                  {SERVICE_LABELS[o.serviceType]}
                </div>
                <h3 className="font-bold font-['Manrope']">{o.title}</h3>
                <p className="text-sm text-slate-600 mt-0.5">{o.description}</p>
              </div>
              <div className="text-right">
                <div className="font-extrabold text-[#2f6fb8] text-lg">
                  {euros(o.priceCents)} €
                  <span className="text-xs font-medium text-slate-500"> / {unitLabel(o.unit)}</span>
                </div>
                <Link
                  href={`/pet/reservation/${o.id}`}
                  className="inline-block mt-2 bg-[#2f6fb8] hover:bg-[#2560a0] text-white px-4 py-2 rounded-full font-bold text-sm transition-colors"
                >
                  Réserver
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {pro.reviews.length > 0 && (
        <>
          <h2 className="text-xl font-bold font-['Manrope'] mb-3">Avis</h2>
          <div className="space-y-3">
            {pro.reviews.map((r) => (
              <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{r.author.name}</span>
                  <span className="text-amber-400 text-sm">
                    {"★".repeat(r.rating)}
                    <span className="text-slate-200">{"★".repeat(5 - r.rating)}</span>
                  </span>
                </div>
                {r.comment && <p className="text-sm text-slate-600 mt-1">{r.comment}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import AdForm from "@/components/admin/AdForm";

export default async function AdsPage() {
  const ads = await prisma.advertisement.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#191c1e] font-headline">Publicités</h1>
        <p className="text-sm text-[#777683] mt-1">
          Les publicités apparaissent nativement dans le fil des annonces avec un badge distinctif
        </p>
      </div>

      {/* How it works */}
      <div className="bg-[#e1e0ff] rounded-2xl px-5 py-4 flex items-start gap-3">
        <span className="material-symbols-outlined text-[#2f6fb8] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
        <div className="text-sm text-[#2f6fb8]">
          <p className="font-semibold mb-0.5">Intégration native</p>
          <p className="text-[#1a5a9e] text-xs leading-relaxed">
            Chaque publicité s&apos;affiche comme une annonce classique avec un badge <strong>&quot;Publicité&quot;</strong>.
            Au clic, l&apos;utilisateur est redirigé vers l&apos;URL de destination. Aucune bannière intrusive.
          </p>
        </div>
      </div>

      <AdForm ads={ads} />
    </div>
  );
}

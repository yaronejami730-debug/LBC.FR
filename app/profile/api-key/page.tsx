import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import ApiKeyManager from "./ApiKeyManager";

export default async function ApiKeyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/profile/api-key");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      isPro: true,
      apiKeys: {
        where: { revokedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { keyPrefix: true, name: true, createdAt: true, lastUsedAt: true },
      },
    },
  });

  if (!user) redirect("/login");

  // Particulier → pas d'accès API
  if (!user.isPro) {
    return (
      <div className="min-h-screen bg-[#f5f7fa]">
        <Navbar />
        <main className="pt-36 pb-20 px-4 max-w-xl mx-auto text-center space-y-5">
          <div className="bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(21,21,125,0.06)] space-y-4">
            <span className="material-symbols-outlined text-[48px] text-slate-300" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
            <h1 className="text-xl font-extrabold text-slate-800 font-['Manrope']">Accès réservé aux pros</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              L'accès à l'API est réservé aux comptes professionnels. Passez votre compte en Pro pour publier des annonces via API.
            </p>
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2f6fb8] text-white rounded-xl text-sm font-bold hover:bg-[#1a5a9e] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">upgrade</span>
              Passer en compte Pro
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const existing = user.apiKeys[0] ?? null;

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      <Navbar />
      <main className="pt-36 pb-20 px-4 max-w-2xl mx-auto space-y-6">

        {/* Fil d'Ariane */}
        <nav className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/profile" className="hover:text-[#2f6fb8] transition-colors">Mon profil</Link>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <span className="text-slate-700 font-medium">Clé API</span>
        </nav>

        {/* Header */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(21,21,125,0.06)]">
          <div className="flex items-center gap-3 mb-1">
            <span className="w-9 h-9 rounded-xl bg-[#2f6fb8]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#2f6fb8] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>api</span>
            </span>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 font-['Manrope']">Clé API</h1>
              <span className="text-[10px] font-bold bg-[#e1e0ff] text-[#2f6fb8] px-2 py-0.5 rounded-full">v1</span>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-3 leading-relaxed">
            Votre clé API vous permet de publier des annonces directement depuis votre logiciel, CRM, ou outil d'automatisation (Make, Zapier, n8n…) sans passer par le site.
          </p>
        </div>

        {/* Manager */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(21,21,125,0.06)]">
          <ApiKeyManager existing={existing} />
        </div>

        {/* Ce qu'on peut faire */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(21,21,125,0.06)] space-y-4">
          <h2 className="text-sm font-extrabold text-slate-800 font-['Manrope']">Ce que vous pouvez faire avec l'API</h2>
          <div className="space-y-3">
            {[
              { icon: "add_circle", title: "Publier une annonce", desc: "POST /api/v1/listings — automobile, immobilier, ou autre catégorie" },
              { icon: "photo_library", title: "Uploader des photos", desc: "POST /api/v1/upload — jusqu'à 15 photos de 10 Mo chacune" },
              { icon: "integration_instructions", title: "Intégrer à votre logiciel", desc: "Compatible avec tout outil qui supporte les requêtes HTTP (DMS, CRM, Make, Zapier, n8n…)" },
            ].map((item) => (
              <div key={item.title} className="flex gap-3 items-start">
                <span className="w-8 h-8 rounded-lg bg-[#2f6fb8]/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#2f6fb8] text-[18px]">{item.icon}</span>
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/api-doc"
            className="inline-flex items-center gap-1.5 text-sm text-[#2f6fb8] font-semibold hover:underline"
          >
            <span className="material-symbols-outlined text-[16px]">menu_book</span>
            Voir la documentation complète
          </Link>
        </div>

      </main>
      <BottomNav />
    </div>
  );
}

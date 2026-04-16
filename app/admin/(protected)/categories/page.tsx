import { getCategorySettings } from "@/app/admin/actions";
import CategoryApprovalClient from "./CategoryApprovalClient";

export default async function CategoriesPage() {
  const settings = await getCategorySettings();

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[#1a1b25]">Approbation par catégorie</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Choisissez pour chaque catégorie si les nouvelles annonces sont publiées automatiquement ou soumises à validation manuelle.
        </p>
      </div>

      {/* Légende */}
      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
          <span className="text-xs font-semibold text-slate-500">Auto-approuvé — annonce publiée immédiatement</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="text-xs font-semibold text-slate-500">Manuel — annonce en attente de validation</span>
        </div>
      </div>

      <CategoryApprovalClient settings={settings} />
    </div>
  );
}

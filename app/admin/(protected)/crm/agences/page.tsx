export const metadata = { title: "Agences — CRM" };

export default function AgencesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">Entreprises / agences</h1>
        <p className="text-slate-500 mt-1">Comptes pro, partenariats, statuts.</p>
      </div>
      <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center">
        <span className="material-symbols-outlined text-5xl text-slate-300">business</span>
        <p className="mt-3 text-slate-600 font-semibold">Module Agences à venir.</p>
        <p className="text-sm text-slate-400 mt-1">Liste comptes pro, partenariats, KYB.</p>
      </div>
    </div>
  );
}

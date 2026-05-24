export const metadata = { title: "Leads — CRM" };

export default function LeadsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">Leads</h1>
        <p className="text-slate-500 mt-1">Pipeline commercial, prospects, conversions.</p>
      </div>
      <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center">
        <span className="material-symbols-outlined text-5xl text-slate-300">leaderboard</span>
        <p className="mt-3 text-slate-600 font-semibold">Module Leads à venir.</p>
        <p className="text-sm text-slate-400 mt-1">Pipeline kanban, attribution, tâches.</p>
      </div>
    </div>
  );
}

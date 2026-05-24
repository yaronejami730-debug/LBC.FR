import Link from "next/link";

export const metadata = { title: "CRM — Admin" };

export default function CrmHome() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">CRM</h1>
        <p className="text-slate-500 mt-1">Gestion commerciale : clients, prospects, agences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card href="/admin/crm/clients" icon="person_add" title="Clients" desc="Créer, modifier, historique" />
        <Card href="/admin/crm/sources" icon="link" title="Sources externes" desc="Importer une annonce depuis un lien (scrape)" />
        <Card href="/admin/crm/leads" icon="leaderboard" title="Leads" desc="Pipeline, prospects, conversions" soon />
        <Card href="/admin/crm/agences" icon="business" title="Entreprises / agences" desc="Comptes pro, partenariats" soon />
      </div>
    </div>
  );
}

function Card({ href, icon, title, desc, soon }: { href: string; icon: string; title: string; desc: string; soon?: boolean }) {
  return (
    <Link
      href={href}
      className="block bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-md hover:border-[#2f6fb8]/30 transition"
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="material-symbols-outlined text-[#2f6fb8] text-2xl">{icon}</span>
        <h3 className="font-bold text-slate-900">{title}</h3>
        {soon && <span className="ml-auto text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Bientôt</span>}
      </div>
      <p className="text-sm text-slate-500">{desc}</p>
    </Link>
  );
}

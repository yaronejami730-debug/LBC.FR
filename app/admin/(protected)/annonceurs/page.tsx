import { prisma } from "@/lib/prisma";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/advertiser-budgets";
import LeadCard, { type Lead } from "./LeadCard";

export const metadata = { title: "Annonceurs — Admin" };
export const dynamic = "force-dynamic";

const OPEN_STATUSES = ["NEW", "CONTACTED", "QUALIFIED"];

export default async function AnnonceursPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const { statut } = await searchParams;
  const filter = LEAD_STATUSES.some((s) => s.value === statut) ? statut : null;

  const [leads, counts] = await Promise.all([
    prisma.advertiserLead.findMany({
      where: filter ? { status: filter } : undefined,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.advertiserLead.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countByStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  const total = counts.reduce((sum, c) => sum + c._count._all, 0);
  const open = OPEN_STATUSES.reduce((sum, s) => sum + (countByStatus[s] ?? 0), 0);

  // Rappels promis sous 24-48 h : on remonte ceux qui ont dépassé le délai.
  const lateCutoff = Date.now() - 48 * 3_600_000;
  const late = leads.filter(
    (l) => l.status === "NEW" && new Date(l.createdAt).getTime() < lateCutoff,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">Annonceurs</h1>
        <p className="text-slate-500 mt-1">
          Demandes de sponsoring déposées depuis le site. Rappel promis sous 24 à 48 heures.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Demandes reçues" value={total} />
        <Stat label="En cours" value={open} />
        <Stat label="Signées" value={countByStatus.WON ?? 0} tone="good" />
        <Stat label="Rappels en retard" value={late} tone={late > 0 ? "bad" : undefined} />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip label="Toutes" href="/admin/annonceurs" active={!filter} count={total} />
        {LEAD_STATUSES.map((s) => (
          <FilterChip
            key={s.value}
            label={LEAD_STATUS_LABELS[s.value]}
            href={`/admin/annonceurs?statut=${s.value}`}
            active={filter === s.value}
            count={countByStatus[s.value] ?? 0}
          />
        ))}
      </div>

      {leads.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-300">campaign</span>
          <p className="mt-3 text-slate-600 font-semibold">
            {filter ? "Aucune demande dans ce statut." : "Aucune demande pour le moment."}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Le formulaire est en bas de la page d&apos;accueil.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead as Lead} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad";
}) {
  const color =
    tone === "good" ? "text-[#216b4d]" : tone === "bad" ? "text-[#b03a26]" : "text-slate-900";
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-extrabold mt-1 tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
  count,
}: {
  label: string;
  href: string;
  active: boolean;
  count: number;
}) {
  return (
    <a
      href={href}
      className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
        active
          ? "bg-[#2f6fb8] text-white border-[#2f6fb8]"
          : "bg-white text-slate-500 border-slate-200 hover:border-[#2f6fb8] hover:text-[#2f6fb8]"
      }`}
    >
      {label} <span className={active ? "text-white/70" : "text-slate-400"}>({count})</span>
    </a>
  );
}

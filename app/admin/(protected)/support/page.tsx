import { prisma } from "@/lib/prisma";
import TicketThread, { type Ticket } from "./TicketThread";

export const metadata = { title: "Support — Admin" };
export const dynamic = "force-dynamic";

/**
 * Files du support, dans l'ordre où on les traite.
 *
 * « À traiter » d'abord : c'est la seule qui compte pour un client qui attend.
 * Les autres servent à retrouver un échange, pas à travailler.
 */
const TABS = [
  { value: "OPEN", label: "À traiter" },
  { value: "WAITING_USER", label: "En attente du client" },
  { value: "RESOLVED", label: "Résolus" },
  { value: "CLOSED", label: "Clos" },
  { value: "ALL", label: "Tous" },
];

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; q?: string }>;
}) {
  const { statut, q } = await searchParams;
  const filter = TABS.some((t) => t.value === statut) ? statut! : "OPEN";
  const search = (q ?? "").trim();

  const [tickets, counts] = await Promise.all([
    prisma.supportTicket.findMany({
      where: {
        ...(filter === "ALL" ? {} : { status: filter }),
        ...(search
          ? {
              OR: [
                { subject: { contains: search, mode: "insensitive" as const } },
                { user: { email: { contains: search, mode: "insensitive" as const } } },
                { user: { name: { contains: search, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
      // Le plus ancien message non traité d'abord : on ne fait pas attendre
      // celui qui patiente depuis trois jours pour répondre au dernier arrivé.
      orderBy: filter === "OPEN" ? { lastMessageAt: "asc" } : { lastMessageAt: "desc" },
      take: 100,
      include: {
        assignedTo: { select: { id: true, name: true } },
        listing: { select: { id: true, title: true } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isPro: true,
            createdAt: true,
            bannedAt: true,
            _count: { select: { listings: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.supportTicket.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  const total = counts.reduce((sum, c) => sum + c._count._all, 0);
  const waiting = byStatus.OPEN ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">Support</h1>
        <p className="text-slate-500 mt-1">
          Les demandes des utilisateurs, du plus ancien message en attente au plus récent.
          {waiting > 0 ? ` ${waiting} attend${waiting > 1 ? "ent" : ""} une réponse.` : ""}
        </p>
      </div>

      <form method="get" className="flex flex-wrap gap-2">
        <input type="hidden" name="statut" value={filter} />
        <input
          name="q"
          defaultValue={search}
          placeholder="Rechercher un sujet, un nom, un email…"
          className="flex-1 min-w-[240px] rounded-xl border border-[#eceef0] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/20"
        />
        <button type="submit" className="rounded-full bg-[#2f6fb8] px-5 py-2.5 text-sm font-bold text-white">
          Rechercher
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <a
            key={t.value}
            href={`/admin/support?statut=${t.value}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              filter === t.value
                ? "bg-[#2f6fb8] text-white"
                : "bg-white text-slate-500 border border-[#eceef0] hover:border-[#2f6fb8]"
            }`}
          >
            {t.label} ({t.value === "ALL" ? total : (byStatus[t.value] ?? 0)})
          </a>
        ))}
      </div>

      {tickets.length === 0 ? (
        <p className="bg-white border border-[#eceef0] rounded-2xl px-6 py-10 text-center text-slate-400 font-medium">
          Aucune demande dans cette file.
        </p>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <TicketThread key={t.id} ticket={JSON.parse(JSON.stringify(t)) as Ticket} />
          ))}
        </div>
      )}
    </div>
  );
}

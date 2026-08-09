import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Centre de sécurité — Admin" };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Centre de sécurité : l'état de la modération en un écran.
 *
 * Les compteurs viennent des tables réelles, jamais d'une estimation — un
 * chiffre de sécurité faux est pire que pas de chiffre. Chaque pavé mène à
 * l'écran où l'on agit.
 */
export default async function SecurityCenterPage() {
  const now = Date.now();
  const since24h = new Date(now - DAY);
  const since7d = new Date(now - 7 * DAY);

  const [
    blockedToday,
    blockedWeek,
    openReports,
    reportedListings,
    watchedAccounts,
    restrictedAccounts,
    bannedAccounts,
    removedListings,
    suspendedPros,
    recentEvents,
  ] = await Promise.all([
    prisma.moderationEvent.count({
      where: { action: "message_blocked", createdAt: { gte: since24h } },
    }),
    prisma.moderationEvent.count({
      where: { action: "message_blocked", createdAt: { gte: since7d } },
    }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.listing.count({ where: { reportCount: { gt: 0 }, deletedAt: null } }),
    // Sous surveillance : score de spam élevé sans restriction encore posée.
    prisma.user.count({ where: { spamScore: { gte: 20 }, restrictedAt: null, bannedAt: null } }),
    prisma.user.count({ where: { restrictedAt: { not: null }, bannedAt: null } }),
    prisma.user.count({ where: { bannedAt: { not: null } } }),
    prisma.listing.count({
      where: { OR: [{ deletedAt: { not: null } }, { shadowBanned: true }, { status: "REJECTED" }] },
    }),
    prisma.user.count({ where: { professionalStatus: "SUSPENDED" } }),
    prisma.moderationEvent.findMany({
      where: {
        action: {
          in: [
            "message_blocked",
            "report_flagged",
            "account_deleted",
            "pro_suspended",
            "pro_rejected",
            "auto_reject",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, action: true, actor: true, reason: true, createdAt: true, userId: true },
    }),
  ]);

  const tiles = [
    {
      label: "Messages bloqués aujourd'hui",
      value: blockedToday,
      sub: `${blockedWeek} sur 7 jours`,
      icon: "block",
      tone: blockedToday > 0 ? "bad" : "neutral",
      href: "/admin/securite",
    },
    {
      label: "Annonces signalées",
      value: reportedListings,
      sub: `${openReports} signalements ouverts`,
      icon: "flag",
      tone: openReports > 0 ? "warn" : "neutral",
      href: "/admin/listings?status=PENDING",
    },
    {
      label: "Comptes sous surveillance",
      value: watchedAccounts,
      sub: "Score de spam élevé",
      icon: "visibility",
      tone: watchedAccounts > 0 ? "warn" : "neutral",
      href: "/admin/users",
    },
    {
      label: "Comptes restreints",
      value: restrictedAccounts,
      sub: "Publication bloquée",
      icon: "pause_circle",
      tone: restrictedAccounts > 0 ? "warn" : "neutral",
      href: "/admin/users",
    },
    {
      label: "Comptes bannis",
      value: bannedAccounts,
      icon: "gavel",
      tone: bannedAccounts > 0 ? "bad" : "neutral",
      href: "/admin/users",
    },
    {
      label: "Annonces retirées",
      value: removedListings,
      sub: "Supprimées, masquées ou refusées",
      icon: "delete",
      tone: "neutral",
      href: "/admin/listings?status=REJECTED",
    },
    {
      label: "Pros suspendus",
      value: suspendedPros,
      icon: "storefront",
      tone: suspendedPros > 0 ? "warn" : "neutral",
      href: "/admin/professionnels?statut=SUSPENDED",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">Centre de sécurité</h1>
        <p className="text-slate-500 mt-1">
          Où en est la modération : blocages, signalements, comptes sous surveillance et sanctions.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            title={t.label}
            className="bg-white rounded-2xl border border-[#eceef0] p-5 hover:shadow-md transition-all"
          >
            <span
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                t.tone === "bad"
                  ? "bg-rose-100 text-rose-700"
                  : t.tone === "warn"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {t.icon}
              </span>
            </span>
            <p className="text-3xl font-extrabold text-[#191c1e] mt-4 font-headline">{t.value}</p>
            <p className="text-sm text-[#777683] mt-0.5">{t.label}</p>
            {t.sub && <p className="text-[10px] text-[#9ca3af] mt-1 font-medium">{t.sub}</p>}
          </Link>
        ))}
      </div>

      <section className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
        <h2 className="font-bold text-[#191c1e] px-6 py-4 border-b border-[#eceef0]">
          Dernières actions de modération
        </h2>
        {recentEvents.length === 0 ? (
          <p className="px-6 py-10 text-center text-slate-400">Rien à signaler.</p>
        ) : (
          <ul className="divide-y divide-[#f2f4f6]">
            {recentEvents.map((e) => (
              <li key={e.id} className="px-6 py-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xs font-mono text-slate-400 shrink-0">
                  {new Date(e.createdAt).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#2f6fb8] shrink-0">
                  {e.action}
                </span>
                <span className="text-sm text-slate-600 min-w-0 flex-1 truncate">{e.reason}</span>
                <span className="text-xs text-slate-400 shrink-0">{e.actor}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { REMOVAL_RETENTION_DAYS } from "@/lib/moderation/removal";
import {
  ReportsTab,
  RemovedListingsTab,
  RejectedListingsTab,
  WatchedAccountsTab,
  BannedAccountsTab,
  HistoryTab,
} from "./tabs";

export const metadata = { title: "Centre de sécurité — Admin" };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

const TABS = [
  { id: "signalements", label: "Signalements", icon: "flag" },
  { id: "retirees", label: "Annonces retirées", icon: "visibility_off" },
  { id: "refusees", label: "Annonces refusées", icon: "block" },
  { id: "surveillance", label: "Sous surveillance", icon: "visibility" },
  { id: "bannis", label: "Comptes bannis", icon: "gavel" },
  { id: "historique", label: "Historique", icon: "history" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTab(v: string | undefined): v is TabId {
  return !!v && TABS.some((t) => t.id === v);
}

/**
 * Centre de sécurité — l'état de la modération en un écran.
 *
 * Les compteurs viennent des tables réelles, jamais d'une estimation : un
 * chiffre de sécurité faux est pire que pas de chiffre.
 *
 * Chaque pavé statistique mène à **son** onglet, pas à une page générique.
 * C'est le point qui manquait : cliquer sur « comptes sous surveillance » pour
 * atterrir sur la liste complète des utilisateurs oblige à refaire à la main le
 * filtre qu'on venait de demander.
 */
export default async function SecurityCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active: TabId = isTab(tab) ? tab : "signalements";

  const now = Date.now();
  const since24h = new Date(now - DAY);
  const since7d = new Date(now - 7 * DAY);
  const soon = new Date(now + 7 * DAY);

  const [
    blockedToday,
    blockedWeek,
    openReports,
    reportedListings,
    pendingListings,
    watchedAccounts,
    bannedAccounts,
    removedListings,
    rejectedListings,
    deletionsScheduled,
    deletionsImminent,
  ] = await Promise.all([
    prisma.moderationEvent.count({
      where: { action: "message_blocked", createdAt: { gte: since24h } },
    }),
    prisma.moderationEvent.count({
      where: { action: "message_blocked", createdAt: { gte: since7d } },
    }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.listing.count({ where: { reportCount: { gt: 0 }, deletedAt: null } }),
    prisma.listing.count({ where: { status: "PENDING", deletedAt: null } }),
    prisma.user.count({
      where: {
        bannedAt: null,
        role: { not: "ADMIN" },
        OR: [
          { watchedAt: { not: null } },
          { spamScore: { gte: 20 } },
          { totalReportsAgainst: { gte: 2 } },
        ],
      },
    }),
    prisma.user.count({ where: { bannedAt: { not: null }, role: { not: "ADMIN" } } }),
    prisma.listing.count({ where: { status: "REMOVED" } }),
    prisma.listing.count({ where: { status: "REJECTED" } }),
    prisma.listing.count({ where: { status: "REMOVED", permanentDeletionAt: { not: null } } }),
    prisma.listing.count({
      where: { status: "REMOVED", permanentDeletionAt: { lte: soon } },
    }),
  ]);

  const tiles = [
    {
      label: "Annonces signalées",
      value: reportedListings,
      sub: `${openReports} signalement(s) ouvert(s)`,
      icon: "flag",
      tone: openReports > 0 ? "bad" : "neutral",
      href: "/admin/securite?tab=signalements",
    },
    {
      label: "Annonces à vérifier",
      value: pendingListings,
      sub: "File de modération",
      icon: "pending",
      tone: pendingListings > 0 ? "warn" : "neutral",
      href: "/admin/listings?status=PENDING",
    },
    {
      label: "Annonces retirées",
      value: removedListings,
      sub: `${rejectedListings} refusée(s)`,
      icon: "visibility_off",
      tone: removedListings > 0 ? "warn" : "neutral",
      href: "/admin/securite?tab=retirees",
    },
    {
      label: "Comptes sous surveillance",
      value: watchedAccounts,
      sub: "À revoir, sans sanction",
      icon: "visibility",
      tone: watchedAccounts > 0 ? "warn" : "neutral",
      href: "/admin/securite?tab=surveillance",
    },
    {
      label: "Comptes bannis",
      value: bannedAccounts,
      sub: "Suppression définitive possible",
      icon: "gavel",
      tone: bannedAccounts > 0 ? "bad" : "neutral",
      href: "/admin/securite?tab=bannis",
    },
    {
      label: "Suppressions programmées",
      value: deletionsScheduled,
      sub: `${deletionsImminent} dans les 7 jours`,
      icon: "delete_forever",
      tone: deletionsImminent > 0 ? "warn" : "neutral",
      href: "/admin/securite?tab=retirees",
    },
    {
      label: "Messages bloqués aujourd'hui",
      value: blockedToday,
      sub: `${blockedWeek} sur 7 jours`,
      icon: "block",
      tone: blockedToday > 0 ? "bad" : "neutral",
      href: "/admin/securite?tab=historique",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">Centre de sécurité</h1>
        <p className="text-slate-500 mt-1">
          Signalements, retraits, comptes surveillés et sanctions — avec le score de confiance en
          appui, jamais à la place de la décision.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            title={t.label}
            className="bg-white rounded-2xl border border-[#eceef0] p-5 hover:shadow-md hover:border-[#d8dce0] transition-all"
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

      <nav className="flex gap-1 overflow-x-auto bg-white rounded-2xl border border-[#eceef0] p-1.5">
        {TABS.map((t) => {
          const on = t.id === active;
          const count =
            t.id === "signalements"
              ? openReports
              : t.id === "retirees"
                ? removedListings
                : t.id === "refusees"
                  ? rejectedListings
                  : t.id === "surveillance"
                    ? watchedAccounts
                    : t.id === "bannis"
                      ? bannedAccounts
                      : null;

          return (
            <Link
              key={t.id}
              href={`/admin/securite?tab=${t.id}`}
              scroll={false}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
                on ? "bg-[#191c1e] text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              {t.label}
              {count !== null && count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${
                    on ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <section>
        {active === "signalements" && <ReportsTab />}
        {active === "retirees" && <RemovedListingsTab />}
        {active === "refusees" && <RejectedListingsTab />}
        {active === "surveillance" && <WatchedAccountsTab />}
        {active === "bannis" && <BannedAccountsTab />}
        {active === "historique" && <HistoryTab />}
      </section>

      <p className="text-[11px] text-slate-400 text-center pb-4">
        Une annonce retirée est conservée {REMOVAL_RETENTION_DAYS} jours, le temps que son auteur la
        corrige, puis détruite automatiquement. Le score de confiance ordonne la file de modération ;
        il ne décide de rien.
      </p>
    </div>
  );
}

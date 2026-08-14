import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { WELLNESS_CATEGORY_LABEL } from "@/lib/moderation/wellness-policy";

export const dynamic = "force-dynamic";

async function getStats() {
  const now = new Date();
  const [
    totalUsers,
    proUsers,
    pendingListings,
    activeListings,
    approvedListings,
    rejectedListings,
    totalAds,
    pendingProAccounts,
    visits30d,
    openSupport,
  ] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isPro: true } }),
      prisma.listing.count({ where: { status: "PENDING", deletedAt: null } }),
      // Truly active = approved + not deleted + not expired
      prisma.listing.count({
        where: {
          status: "APPROVED",
          deletedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      // All approved (including expired/deleted) — for the bar chart
      prisma.listing.count({ where: { status: "APPROVED" } }),
      prisma.listing.count({ where: { status: "REJECTED" } }),
      prisma.advertisement.count({ where: { isActive: true } }),
      // Comptes professionnels en attente d'un modérateur — la file de travail.
      prisma.user.count({
        where: { professionalStatus: { in: ["PENDING", "INFO_REQUESTED"] } },
      }),
      // Visites : pages vues sur 30 jours, journalisées par le tracker.
      prisma.userEvent.count({
        where: {
          kind: "page_view",
          createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      // Demandes de support qui attendent une réponse : un client qui patiente
      // doit se voir depuis l'accueil, pas seulement dans sa file.
      prisma.supportTicket.count({ where: { status: "OPEN" } }),
    ]);
  return {
    totalUsers,
    proUsers,
    pendingListings,
    activeListings,
    approvedListings,
    rejectedListings,
    totalAds,
    pendingProAccounts,
    visits30d,
    openSupport,
  };
}

async function getRecentPending() {
  // `deletedAt: null` — sinon une annonce en attente puis supprimée reste
  // affichée ici alors que le compteur (qui filtre deletedAt) ne la compte pas.
  return prisma.listing.findMany({
    where: { status: "PENDING", deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { user: { select: { name: true } } },
  });
}

export default async function AdminDashboard() {
  const [stats, pending] = await Promise.all([getStats(), getRecentPending()]);

  // Chaque pavé mène à l'écran qui permet d'agir dessus : un compteur qui ne
  // se clique pas oblige à retrouver la page à la main.
  const cards = [
    {
      label: "Comptes particuliers",
      value: stats.totalUsers - stats.proUsers,
      icon: "person",
      color: "bg-[#e1e0ff] text-[#2f6fb8]",
      href: "/admin/users",
    },
    {
      label: "Comptes professionnels",
      value: stats.proUsers,
      icon: "storefront",
      color: "bg-[#d5e3fc] text-[#2f6fb8]",
      href: "/admin/professionnels?statut=APPROVED",
    },
    {
      label: "Annonces en attente",
      value: stats.pendingListings,
      icon: "pending_actions",
      color: "bg-amber-100 text-amber-700",
      href: "/admin/listings?status=PENDING",
      urgent: stats.pendingListings > 0,
    },
    {
      label: "Annonces actives",
      value: stats.activeListings,
      icon: "check_circle",
      color: "bg-emerald-100 text-emerald-700",
      href: "/admin/listings?status=APPROVED",
    },
    {
      label: "Support en attente",
      value: stats.openSupport,
      icon: "support_agent",
      color: "bg-amber-100 text-amber-700",
      href: "/admin/support?statut=OPEN",
      urgent: stats.openSupport > 0,
    },
    {
      label: "Visites (30 j)",
      value: stats.visits30d,
      icon: "visibility",
      color: "bg-slate-100 text-slate-600",
      href: "/admin/behavioral",
    },
    {
      label: "En attente de vérification",
      value: stats.pendingProAccounts,
      icon: "verified_user",
      color: "bg-amber-100 text-amber-700",
      href: "/admin/verifications-pro?statut=PENDING",
      urgent: stats.pendingProAccounts > 0,
      sub: "Comptes professionnels",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#191c1e] font-headline">Dashboard</h1>
        <p className="text-sm text-[#777683] mt-1">Vue d&apos;ensemble de la plateforme</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`bg-white rounded-2xl p-5 border transition-all hover:shadow-md ${
              card.urgent ? "border-amber-200 ring-1 ring-amber-200" : "border-[#eceef0]"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {card.icon}
                </span>
              </div>
              {card.urgent && (
                <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Action requise
                </span>
              )}
            </div>
            <p className="text-3xl font-extrabold text-[#191c1e] mt-4 font-headline">{card.value}</p>
            <p className="text-sm text-[#777683] mt-0.5">{card.label}</p>
            {"sub" in card && card.sub && (
              <p className="text-[10px] text-[#9ca3af] mt-1 font-medium">{card.sub}</p>
            )}
          </Link>
        ))}
      </div>

      {/* Two-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Pending Listings */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#eceef0]">
            <h2 className="font-bold text-[#191c1e]">Annonces en attente</h2>
            <Link href="/admin/listings?status=PENDING" className="text-xs text-[#2f6fb8] font-semibold hover:underline">
              Voir tout →
            </Link>
          </div>
          {pending.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <span className="material-symbols-outlined text-4xl text-[#c7c5d4]" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
              <p className="text-sm text-[#777683] mt-2">Aucune annonce en attente</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#f2f4f6]">
              {pending.map((listing) => {
                const img = (() => {
                  try {
                    const imgs = JSON.parse(listing.images) as string[];
                    return imgs[0] || "";
                  } catch {
                    return "";
                  }
                })();
                return (
                  <li key={listing.id} className="flex items-center gap-4 px-6 py-3 hover:bg-[#f7f9fb] transition-colors">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#f2f4f6] flex-shrink-0">
                      {img ? (
                        <img src={img} alt={listing.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-[#777683] flex items-center justify-center w-full h-full text-xl">
                          image
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#191c1e] truncate">{listing.title}</p>
                      <p className="text-xs text-[#777683]">
                        {listing.user.name} · {listing.price.toLocaleString("fr-FR")} €
                      </p>
                    </div>
                    <Link
                      href="/admin/listings?status=PENDING"
                      className="text-xs font-semibold text-[#2f6fb8] bg-[#e1e0ff] px-3 py-1 rounded-full hover:bg-[#2f6fb8] hover:text-white transition-colors flex-shrink-0"
                    >
                      Modérer
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#eceef0]">
            <h2 className="font-bold text-[#191c1e]">Annonces</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            {[
              { label: "En attente", value: stats.pendingListings, color: "bg-amber-400" },
              { label: "Actives sur le site", value: stats.activeListings, color: "bg-emerald-400" },
              { label: "Refusées", value: stats.rejectedListings, color: "bg-[#ba1a1a]" },
            ].map((s) => {
              const total = stats.pendingListings + stats.approvedListings + stats.rejectedListings || 1;
              const pct = Math.round((s.value / total) * 100);
              return (
                <div key={s.label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-[#464652]">{s.label}</span>
                    <span className="font-bold text-[#191c1e]">{s.value}</span>
                  </div>
                  <div className="h-1.5 bg-[#f2f4f6] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-6 pb-5">
            <Link
              href="/admin/ads"
              className="flex items-center justify-between bg-[#f2f4f6] hover:bg-[#e1e0ff] transition-colors rounded-xl px-4 py-3 group"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#2f6fb8]" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
                <span className="text-sm font-semibold text-[#2f6fb8]">{stats.totalAds} pub{stats.totalAds !== 1 ? "s" : ""} active{stats.totalAds !== 1 ? "s" : ""}</span>
              </div>
              <span className="material-symbols-outlined text-[16px] text-[#2f6fb8] group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

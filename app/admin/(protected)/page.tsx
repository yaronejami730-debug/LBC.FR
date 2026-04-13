import { prisma } from "@/lib/prisma";
import Link from "next/link";
import LiveVisitorCount from "@/components/admin/LiveVisitorCount";

async function getStats() {
  const [totalUsers, pendingListings, approvedListings, rejectedListings, totalAds] =
    await Promise.all([
      prisma.user.count(),
      prisma.listing.count({ where: { status: "PENDING" } }),
      prisma.listing.count({ where: { status: "APPROVED" } }),
      prisma.listing.count({ where: { status: "REJECTED" } }),
      prisma.advertisement.count({ where: { isActive: true } }),
    ]);
  return { totalUsers, pendingListings, approvedListings, rejectedListings, totalAds };
}

async function getRecentPending() {
  return prisma.listing.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { user: { select: { name: true } } },
  });
}

export default async function AdminDashboard() {
  const [stats, pending] = await Promise.all([getStats(), getRecentPending()]);

  const cards = [
    {
      label: "Utilisateurs inscrits",
      value: stats.totalUsers,
      icon: "group",
      color: "bg-[#e1e0ff] text-[#2f6fb8]",
      href: "/admin/users",
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
      label: "Annonces publiées",
      value: stats.approvedListings,
      icon: "check_circle",
      color: "bg-emerald-100 text-emerald-700",
      href: "/admin/listings?status=APPROVED",
    },
    {
      label: "Publicités actives",
      value: stats.totalAds,
      icon: "campaign",
      color: "bg-[#d5e3fc] text-[#515f74]",
      href: "/admin/ads",
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
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-5">
        <LiveVisitorCount />
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
              { label: "Approuvées", value: stats.approvedListings, color: "bg-emerald-400" },
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

import { prisma } from "@/lib/prisma";
import UserActions from "@/components/admin/UserActions";

export default async function UsersPage() {
  const now = new Date();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      isPro: true,
      companyName: true,
      siret: true,
      verified: true,
      adminNote: true,
      memberSince: true,
      createdAt: true,
      _count: {
        select: {
          listings: true,
        },
      },
      listings: {
        where: { deletedAt: null },
        select: {
          status: true,
          expiresAt: true,
        },
      },
    },
  });

  // Compute per-user breakdown from fetched listings
  const usersWithBreakdown = users.map((u) => {
    const active = u.listings.filter(
      (l) => l.status === "APPROVED" && (!l.expiresAt || l.expiresAt > now)
    ).length;
    const pending = u.listings.filter((l) => l.status === "PENDING").length;
    return { ...u, activeCount: active, pendingCount: pending };
  });

  const total = usersWithBreakdown.length;
  const verified = usersWithBreakdown.filter((u) => u.verified).length;
  const unverified = total - verified;
  const proCount = usersWithBreakdown.filter((u) => u.isPro).length;
  const particulierCount = total - proCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#191c1e] font-headline">Utilisateurs</h1>
          <p className="text-sm text-[#777683] mt-1">Gestion et vérification des comptes</p>
        </div>
        <div className="flex items-center gap-2 text-sm flex-wrap justify-end">
          <span className="bg-white border border-[#eceef0] px-3 py-1.5 rounded-xl font-medium text-[#191c1e]">
            {total} inscrits
          </span>
          <span className="bg-[#2f6fb8] text-white px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>business_center</span>
            {proCount} Pro
          </span>
          <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
            {particulierCount} Particuliers
          </span>
          <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl font-semibold">
            {verified} vérifiés
          </span>
          <span className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl font-semibold">
            {unverified} non vérifiés
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#f2f4f6] bg-[#f7f9fb]">
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-6 py-3">ID</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-6 py-3">Utilisateur</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Compte</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Email</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Rôle</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Annonces</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Membre depuis</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Note admin</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3 min-w-52">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f4f6]">
              {usersWithBreakdown.map((user) => (
                <tr key={user.id} className="hover:bg-[#f7f9fb] transition-colors">
                  {/* ID */}
                  <td className="px-6 py-3">
                    <span className="text-xs font-mono text-[#9ca3af]">#{user.id.slice(0, 8)}</span>
                  </td>
                  {/* Avatar + Name */}
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-[#e1e0ff] flex items-center justify-center flex-shrink-0">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[#2f6fb8] text-sm font-bold">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-[#191c1e] whitespace-nowrap">{user.name}</span>
                    </div>
                  </td>

                  {/* Compte type */}
                  <td className="px-4 py-3">
                    {user.isPro ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#2f6fb8] text-white px-2.5 py-0.5 rounded-full w-fit">
                          <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>business_center</span>
                          Pro
                        </span>
                        {user.companyName && (
                          <span className="text-[10px] text-[#777683] font-medium truncate max-w-[120px]">{user.companyName}</span>
                        )}
                        {user.siret && (
                          <span className="text-[9px] text-[#9ca3af] font-mono">{user.siret}</span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#777683] bg-slate-100 px-2.5 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                        Particulier
                      </span>
                    )}
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-[#464652]">{user.email}</span>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    {user.role === "ADMIN" ? (
                      <span className="text-xs font-bold bg-[#2f6fb8] text-white px-2.5 py-0.5 rounded-full">Admin</span>
                    ) : (
                      <span className="text-xs text-[#777683]">Utilisateur</span>
                    )}
                  </td>

                  {/* Listings breakdown */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {user.activeCount > 0 && (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          {user.activeCount} active{user.activeCount > 1 ? "s" : ""}
                        </span>
                      )}
                      {user.pendingCount > 0 && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          {user.pendingCount} en attente
                        </span>
                      )}
                      {user.activeCount === 0 && user.pendingCount === 0 && (
                        <span className="text-xs text-[#c7c5d4]">—</span>
                      )}
                    </div>
                  </td>

                  {/* Member since */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-[#777683]">{user.memberSince}</span>
                  </td>

                  {/* Admin note */}
                  <td className="px-4 py-3 max-w-[200px]">
                    {user.adminNote ? (
                      <span className="text-xs text-[#464652] italic line-clamp-1">{user.adminNote}</span>
                    ) : (
                      <span className="text-xs text-[#c7c5d4]">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    {user.role === "ADMIN" ? (
                      <span className="text-xs text-[#777683] italic">Compte admin</span>
                    ) : (
                      <UserActions userId={user.id} verified={user.verified} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-5xl text-[#c7c5d4]">group</span>
            <p className="text-[#777683] mt-2">Aucun utilisateur</p>
          </div>
        )}
      </div>
    </div>
  );
}

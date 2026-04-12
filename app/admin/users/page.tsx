import { prisma } from "@/lib/prisma";
import UserActions from "@/components/admin/UserActions";

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      verified: true,
      adminNote: true,
      memberSince: true,
      createdAt: true,
      _count: { select: { listings: true } },
    },
  });

  const total = users.length;
  const verified = users.filter((u) => u.verified).length;
  const unverified = total - verified;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#191c1e] font-headline">Utilisateurs</h1>
          <p className="text-sm text-[#777683] mt-1">Gestion et vérification des comptes</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="bg-white border border-[#eceef0] px-3 py-1.5 rounded-xl font-medium text-[#191c1e]">
            {total} inscrits
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
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-6 py-3">Utilisateur</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Email</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Rôle</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Annonces</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Membre depuis</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3">Note admin</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#777683] px-4 py-3 min-w-52">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f4f6]">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-[#f7f9fb] transition-colors">
                  {/* Avatar + Name */}
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-[#e1e0ff] flex items-center justify-center flex-shrink-0">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[#15157d] text-sm font-bold">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-[#191c1e] whitespace-nowrap">{user.name}</span>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-[#464652]">{user.email}</span>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    {user.role === "ADMIN" ? (
                      <span className="text-xs font-bold bg-[#15157d] text-white px-2.5 py-0.5 rounded-full">Admin</span>
                    ) : (
                      <span className="text-xs text-[#777683]">Utilisateur</span>
                    )}
                  </td>

                  {/* Listings count */}
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-[#191c1e]">{user._count.listings}</span>
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

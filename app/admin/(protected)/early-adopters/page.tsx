import { prisma } from "@/lib/prisma";

export default async function EarlyAdoptersPage() {
  const [entries, total] = await Promise.all([
    prisma.earlyAdopter.findMany({
      orderBy: { registeredAt: "asc" },
    }),
    prisma.earlyAdopter.count(),
  ]);

  const claimed = entries.filter((e) => e.claimedAt).length;
  const remaining = Math.max(0, 50 - total);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#191c1e] font-headline">
          Early Adopters — 50 premiers pros
        </h1>
        <p className="text-sm text-[#777683] mt-1">
          Pré-inscrits éligibles à −50% sur nos publicités pendant 3 ans.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Pré-inscrits", value: total, icon: "group_add", color: "bg-[#2f6fb8]/10 text-[#2f6fb8]" },
          { label: "Places restantes", value: remaining, icon: "hourglass_top", color: remaining > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600" },
          { label: "Inscrits", value: claimed, icon: "how_to_reg", color: "bg-emerald-100 text-emerald-700" },
          { label: "Pré-inscrits", value: total - claimed, icon: "schedule", color: "bg-[#fbbf24]/20 text-amber-700" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-[#eceef0] p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
            </div>
            <p className="text-3xl font-extrabold text-[#191c1e] font-headline">{s.value}</p>
            <p className="text-xs text-[#777683] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Barre de progression */}
      <div className="bg-white rounded-2xl border border-[#eceef0] p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-[#191c1e]">Places occupées</p>
          <p className="text-sm font-black text-[#2f6fb8]">{total} / 50</p>
        </div>
        <div className="h-3 bg-[#f2f4f6] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#2f6fb8] to-[#fbbf24] transition-all"
            style={{ width: `${Math.min(100, Math.round((total / 50) * 100))}%` }}
          />
        </div>
        {remaining === 0 && (
          <p className="text-xs text-red-600 font-semibold mt-2">
            Les 50 places sont complètes.
          </p>
        )}
      </div>

      {/* Liste */}
      <div className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#eceef0]">
          <h2 className="font-bold text-[#191c1e] text-sm">Liste des pré-inscrits</h2>
        </div>

        {entries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <span className="material-symbols-outlined text-4xl text-[#c7c5d4]" style={{ fontVariationSettings: "'FILL' 1" }}>group_add</span>
            <p className="text-sm text-[#777683] mt-2">Aucun pré-inscrit pour l&apos;instant</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f2f4f6]">
                  {["#", "Société", "Gérant", "Email", "Date", "Statut"].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#777683]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2f4f6]">
                {entries.map((entry, i) => (
                  <tr key={entry.id} className="hover:bg-[#f7f9fb] transition-colors">
                    <td className="px-6 py-4 text-sm font-black text-[#2f6fb8]">
                      {i + 1}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-[#191c1e]">{entry.companyName}</p>
                      {entry.siret && (
                        <p className="text-xs text-[#777683] font-mono">{entry.siret}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#464652]">
                      {entry.managerFirstName}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#464652]">
                      {entry.email}
                    </td>
                    <td className="px-6 py-4 text-xs text-[#777683] whitespace-nowrap">
                      {new Date(entry.registeredAt).toLocaleDateString("fr-FR", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      {entry.claimedAt ? (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-[11px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide">
                          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          Inscrit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-[#fbbf24]/20 text-amber-700 text-[11px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          Pré-inscrit
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

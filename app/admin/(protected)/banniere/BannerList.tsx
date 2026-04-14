"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  bgFrom: string;
  bgTo: string;
  bgImage: string | null;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
}

export default function BannerList({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function toggle(id: string, active: boolean) {
    setLoading(id);
    await fetch("/api/admin/hero-banner", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: active }),
    });
    setLoading(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette bannière ?")) return;
    setLoading(id);
    await fetch("/api/admin/hero-banner", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#eceef0] flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-[#191c1e]">Bannières créées</h2>
        <span className="text-[12px] text-[#777683] font-medium">{banners.length} au total</span>
      </div>

      {banners.length === 0 ? (
        <div className="py-16 text-center">
          <span className="material-symbols-outlined text-4xl text-[#c7c5d4] block mb-2">photo_film_stack</span>
          <p className="text-[#777683] text-sm">Aucune bannière créée</p>
        </div>
      ) : (
        <div className="divide-y divide-[#f2f4f6]">
          {banners.map((b) => (
            <div key={b.id} className="px-5 py-4 hover:bg-[#f7f9fb] transition-colors">
              {/* Mini preview */}
              <div className="h-14 rounded-xl overflow-hidden mb-3 flex items-center px-4"
                style={b.bgImage
                  ? { backgroundImage: `linear-gradient(135deg, ${b.bgFrom}cc, ${b.bgTo}dd), url(${b.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : { background: `linear-gradient(135deg, ${b.bgFrom}, ${b.bgTo})` }
                }>
                <div>
                  <p className="text-white text-[13px] font-bold leading-tight line-clamp-1">{b.title}</p>
                  {b.subtitle && <p className="text-white/70 text-[11px] mt-0.5 line-clamp-1">{b.subtitle}</p>}
                </div>
              </div>

              {/* Status + actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {b.isActive ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wide flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-[#f2f4f6] text-[#777683] uppercase tracking-wide flex-shrink-0">
                      Inactive
                    </span>
                  )}
                  {b.startsAt && (
                    <span className="text-[10px] text-[#777683] truncate">
                      {new Date(b.startsAt).toLocaleDateString("fr-FR")}
                      {b.endsAt ? ` → ${new Date(b.endsAt).toLocaleDateString("fr-FR")}` : " → ∞"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => toggle(b.id, !b.isActive)}
                    disabled={loading === b.id}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 ${
                      b.isActive
                        ? "bg-[#f2f4f6] text-[#464652] hover:bg-amber-100 hover:text-amber-700"
                        : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    }`}
                  >
                    {loading === b.id ? "…" : b.isActive ? "Désactiver" : "Activer"}
                  </button>
                  <button
                    onClick={() => remove(b.id)}
                    disabled={loading === b.id}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-[#fff8f7] text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

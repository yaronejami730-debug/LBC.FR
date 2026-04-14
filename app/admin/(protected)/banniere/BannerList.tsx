"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  bgFrom: string;
  bgTo: string;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
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
    setLoading(id);
    await fetch("/api/admin/hero-banner", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setLoading(null);
    router.refresh();
  }

  if (banners.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#eceef0] flex items-center justify-center py-16">
        <p className="text-[#777683] text-sm">Aucune bannière créée</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#eceef0]">
        <h2 className="font-bold text-[#191c1e]">Bannières ({banners.length})</h2>
      </div>
      <div className="divide-y divide-[#f2f4f6]">
        {banners.map((b) => (
          <div key={b.id} className="px-5 py-4">
            {/* Miniature */}
            <div className="h-16 rounded-xl overflow-hidden mb-3" style={{ background: `linear-gradient(135deg, ${b.bgFrom}, ${b.bgTo})` }}>
              <div className="h-full flex flex-col justify-center px-4">
                <p className="text-white text-sm font-bold leading-tight line-clamp-1">{b.title}</p>
                {b.subtitle && <p className="text-white/70 text-xs mt-0.5 line-clamp-1">{b.subtitle}</p>}
              </div>
            </div>

            {/* Infos */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {b.isActive ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Active</span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f2f4f6] text-[#777683]">Inactive</span>
                )}
                {b.startsAt && (
                  <span className="text-[10px] text-[#777683]">
                    {new Date(b.startsAt).toLocaleDateString("fr-FR")} → {b.endsAt ? new Date(b.endsAt).toLocaleDateString("fr-FR") : "∞"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggle(b.id, !b.isActive)} disabled={loading === b.id}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    b.isActive
                      ? "bg-[#f2f4f6] text-[#777683] hover:bg-amber-100 hover:text-amber-700"
                      : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  }`}>
                  {loading === b.id ? "…" : b.isActive ? "Désactiver" : "Activer"}
                </button>
                <button onClick={() => remove(b.id)} disabled={loading === b.id}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffb4ab] transition-colors">
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

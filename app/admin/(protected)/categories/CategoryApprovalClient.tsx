"use client";

import { useState, useTransition } from "react";
import { updateCategoryApproval } from "@/app/admin/actions";
import { CATEGORIES } from "@/lib/categories";
import { Toggle } from "@/components/ui/Toggle";

type Setting = { categoryId: string; approvalMode: string };

export default function CategoryApprovalClient({ settings }: { settings: Setting[] }) {
  const [optimistic, setOptimistic] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of settings) map[s.categoryId] = s.approvalMode;
    return map;
  });
  const [, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);

  function getMode(categoryId: string) {
    return optimistic[categoryId] ?? "AUTO";
  }

  function toggle(categoryId: string, manual: boolean) {
    const next = manual ? "MANUAL" : "AUTO";
    setOptimistic((prev) => ({ ...prev, [categoryId]: next }));
    setSavingId(categoryId);
    startTransition(async () => {
      await updateCategoryApproval(categoryId, next);
      setSavingId(null);
    });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {CATEGORIES.map((cat) => {
        const mode = getMode(cat.id);
        const isManual = mode === "MANUAL";

        return (
          <div
            key={cat.id}
            className="bg-white border border-[#eceef0] rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Icône */}
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isManual ? "bg-amber-50" : "bg-emerald-50"}`}>
              <span className={`material-symbols-outlined text-xl ${isManual ? "text-amber-600" : "text-emerald-600"}`}
                style={{ fontVariationSettings: "'FILL' 1" }}>
                {cat.icon}
              </span>
            </div>

            {/* Label */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#1a1b25] truncate">{cat.label}</p>
              <p className={`text-xs font-semibold mt-0.5 ${isManual ? "text-amber-600" : "text-emerald-600"}`}>
                {isManual ? "Approbation manuelle" : "Auto-approuvé"}
              </p>
            </div>

            {/* Toggle */}
            <Toggle
              checked={isManual}
              onChange={(next) => toggle(cat.id, next)}
              loading={savingId === cat.id}
              tone="amber"
              label={`Approbation manuelle pour ${cat.label}`}
              title={isManual ? "Passer en auto-approuvé" : "Passer en approbation manuelle"}
            />
          </div>
        );
      })}
    </div>
  );
}

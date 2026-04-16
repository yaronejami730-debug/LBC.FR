"use client";

import { useState, useTransition } from "react";
import { updateCategoryApproval } from "@/app/admin/actions";
import { CATEGORIES } from "@/lib/categories";

type Setting = { categoryId: string; approvalMode: string };

export default function CategoryApprovalClient({ settings }: { settings: Setting[] }) {
  const [optimistic, setOptimistic] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of settings) map[s.categoryId] = s.approvalMode;
    return map;
  });
  const [pending, startTransition] = useTransition();

  function getMode(categoryId: string) {
    return optimistic[categoryId] ?? "AUTO";
  }

  function toggle(categoryId: string) {
    const current = getMode(categoryId);
    const next = current === "AUTO" ? "MANUAL" : "AUTO";
    setOptimistic((prev) => ({ ...prev, [categoryId]: next }));
    startTransition(async () => {
      await updateCategoryApproval(categoryId, next as "AUTO" | "MANUAL");
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
            <button
              onClick={() => toggle(cat.id)}
              disabled={pending}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fb8] ${
                isManual ? "bg-amber-400" : "bg-emerald-400"
              }`}
              title={isManual ? "Passer en auto-approuvé" : "Passer en approbation manuelle"}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                isManual ? "translate-x-6" : "translate-x-0.5"
              }`} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { CATEGORIES } from "@/lib/categories";
import { COMMON_FILTERS, CATEGORY_FILTERS, FilterGroup } from "@/lib/filters-config";
import { useRouter } from "next/navigation";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

type FilterValues = Record<string, string>;

function getFiltersForCat(categoryId: string): FilterGroup[] {
  const specific = CATEGORY_FILTERS[categoryId] ?? [];
  const common =
    categoryId === "emploi"
      ? COMMON_FILTERS.filter((g) => g.label !== "Prix")
      : COMMON_FILTERS;
  return [...specific, ...common];
}

export default function FilterBuilder({ onClose, onSaved }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"category" | "filters" | "name">("category");
  const [category, setCategory] = useState("");
  const [values, setValues] = useState<FilterValues>({});
  const [searchName, setSearchName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filterGroups = category ? getFiltersForCat(category) : COMMON_FILTERS;

  const setValue = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const activeFilterCount = Object.values(values).filter((v) => v.trim() !== "").length;

  async function handleSave() {
    if (!searchName.trim()) { setError("Donnez un nom à cette recherche"); return; }
    setSaving(true);
    setError("");
    try {
      const filters: Record<string, string> = { ...values };
      if (category) filters.category = category;

      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: searchName.trim(), filters }),
      });
      if (!res.ok) throw new Error("Erreur lors de la sauvegarde");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur interne");
      setSaving(false);
    }
  }

  const selectedCat = CATEGORIES.find((c) => c.id === category);

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div
        className="relative bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            {step !== "category" && (
              <button
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
                onClick={() => setStep(step === "filters" ? "category" : "filters")}
              >
                <span className="material-symbols-outlined text-xl text-slate-500">arrow_back</span>
              </button>
            )}
            <div>
              <h2 className="text-base font-extrabold text-on-surface font-['Manrope']">
                {step === "category" && "Créer une recherche"}
                {step === "filters" && "Affiner les filtres"}
                {step === "name" && "Nommer la recherche"}
              </h2>
              <p className="text-xs text-outline">
                {step === "category" && "Choisissez une catégorie (optionnel)"}
                {step === "filters" && (selectedCat ? selectedCat.label : "Tous les articles")}
                {step === "name" && `${activeFilterCount} filtre${activeFilterCount !== 1 ? "s" : ""} actif${activeFilterCount !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-xl text-slate-600">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Step 1 — Category */}
          {step === "category" && (
            <>
              <button
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                  category === ""
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-slate-200 hover:border-slate-300 text-on-surface"
                }`}
                onClick={() => { setCategory(""); }}
              >
                <span className="material-symbols-outlined text-xl">apps</span>
                <span className="font-semibold text-sm">Toutes catégories</span>
                {category === "" && <span className="material-symbols-outlined text-base ml-auto" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
              </button>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border-2 text-left transition-all ${
                      category === cat.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-slate-200 hover:border-slate-300 text-on-surface"
                    }`}
                    onClick={() => setCategory(cat.id)}
                  >
                    <span className="material-symbols-outlined text-lg">{cat.icon}</span>
                    <span className="font-medium text-xs leading-tight">{cat.label}</span>
                    {category === cat.id && (
                      <span className="material-symbols-outlined text-sm ml-auto shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 2 — Filters */}
          {step === "filters" && (
            <div className="space-y-5">
              {/* keyword search */}
              <div>
                <label className="block text-xs font-semibold text-outline mb-1.5 uppercase tracking-wide">Mots-clés</label>
                <input
                  type="text"
                  placeholder="Ex: iPhone 14, BMW Série 3…"
                  value={values.q || ""}
                  onChange={(e) => setValue("q", e.target.value)}
                  className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40 border border-transparent focus:border-primary/30 transition-all placeholder:text-outline-variant/60"
                />
              </div>

              {filterGroups.map((group) => {
                // Skip "Trier par" in the builder (not a filter)
                if (group.label === "Trier par") return null;
                return (
                  <div key={group.label}>
                    <label className="block text-xs font-semibold text-outline mb-1.5 uppercase tracking-wide">{group.label}</label>
                    <div className={`${group.fields.length > 1 ? "grid grid-cols-2 gap-2" : ""}`}>
                      {group.fields.map((field) => {
                        if (field.type === "select") {
                          return (
                            <select
                              key={field.key}
                              value={values[field.key] || ""}
                              onChange={(e) => setValue(field.key, e.target.value)}
                              className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40 border border-transparent focus:border-primary/30 transition-all"
                            >
                              <option value="">{field.emptyLabel || "Peu importe"}</option>
                              {field.options?.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          );
                        }
                        if (field.type === "text") {
                          return (
                            <input
                              key={field.key}
                              type="text"
                              placeholder={field.label}
                              value={values[field.key] || ""}
                              onChange={(e) => setValue(field.key, e.target.value)}
                              className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40 border border-transparent focus:border-primary/30 transition-all placeholder:text-outline-variant/60"
                            />
                          );
                        }
                        // range / number
                        return (
                          <div key={field.key} className="relative">
                            <input
                              type="number"
                              placeholder={field.label}
                              value={values[field.key] || ""}
                              min={field.min}
                              max={field.max}
                              onChange={(e) => setValue(field.key, e.target.value)}
                              className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40 border border-transparent focus:border-primary/30 transition-all placeholder:text-outline-variant/60 pr-10"
                            />
                            {field.unit && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-outline pointer-events-none">{field.unit}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 3 — Name */}
          {step === "name" && (
            <div className="space-y-5 pt-1">
              <div>
                <label className="block text-xs font-semibold text-outline mb-1.5 uppercase tracking-wide">Nom de la recherche</label>
                <input
                  type="text"
                  placeholder="Ex: BMW diesel Paris, iPhone pas cher…"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  autoFocus
                  className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40 border border-transparent focus:border-primary/30 transition-all placeholder:text-outline-variant/60"
                />
              </div>

              {/* Summary */}
              {(Object.entries(values).filter(([, v]) => v) as [string, string][]).length > 0 && (
                <div className="bg-surface-container-low rounded-xl p-4">
                  <p className="text-xs font-semibold text-outline uppercase tracking-wide mb-2">Résumé des filtres</p>
                  <div className="flex flex-wrap gap-1.5">
                    {category && (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-full font-medium">
                        <span className="material-symbols-outlined text-xs">{CATEGORIES.find((c) => c.id === category)?.icon || "category"}</span>
                        {CATEGORIES.find((c) => c.id === category)?.label}
                      </span>
                    )}
                    {(Object.entries(values).filter(([, v]) => v) as [string, string][]).map(([k, v]) => (
                      <span key={k} className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">{v}</span>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <p className="text-red-500 text-sm font-medium">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-slate-100 shrink-0">
          {step === "category" && (
            <button
              className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-sm shadow-md shadow-primary/20 active:scale-[0.98] transition-transform"
              onClick={() => setStep("filters")}
            >
              Continuer
              <span className="material-symbols-outlined text-base ml-1.5 align-[-3px]">arrow_forward</span>
            </button>
          )}
          {step === "filters" && (
            <div className="flex gap-2">
              <button
                className="flex-1 py-3.5 bg-surface-container text-on-surface rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform"
                onClick={() => { setValues({}); }}
              >
                Réinitialiser
              </button>
              <button
                className="flex-[2] py-3.5 bg-primary text-white rounded-xl font-bold text-sm shadow-md shadow-primary/20 active:scale-[0.98] transition-transform"
                onClick={() => setStep("name")}
              >
                Enregistrer la recherche
                <span className="material-symbols-outlined text-base ml-1.5 align-[-3px]">bookmark</span>
              </button>
            </div>
          )}
          {step === "name" && (
            <button
              className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-sm shadow-md shadow-primary/20 active:scale-[0.98] transition-transform disabled:opacity-60"
              onClick={handleSave}
              disabled={saving || !searchName.trim()}
            >
              {saving ? "Enregistrement…" : "Créer la recherche"}
              {!saving && <span className="material-symbols-outlined text-base ml-1.5 align-[-3px]">check</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { setListingCategory } from "@/app/admin/actions";
import { CATEGORIES } from "@/lib/categories";

/**
 * Reclassement d'une annonce depuis la file de modération.
 *
 * Le rangement est la première cause d'annonce invisible : un vendeur choisit
 * « Divers » par défaut et son article n'apparaît dans aucune rubrique. Refuser
 * l'annonce pour cela revient à punir une erreur de menu déroulant — d'où la
 * correction directe, en deux clics, sans sortir de la liste.
 */
export default function CategoryPicker({
  listingId,
  category,
  subcategory,
}: {
  listingId: string;
  category: string;
  subcategory: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState(category);
  const [sub, setSub] = useState(subcategory ?? "");
  const [saved, setSaved] = useState<{ category: string; subcategory: string | null }>({
    category,
    subcategory,
  });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const current = CATEGORIES.find((c) => c.id === cat);
  const label = CATEGORIES.find((c) => c.id === saved.category)?.label ?? saved.category;

  function save() {
    setError("");
    const next = { category: cat, subcategory: sub || null };
    start(async () => {
      const res = await setListingCategory(listingId, cat, sub || null).catch((e) => ({
        ok: false as const,
        error: e instanceof Error ? e.message : "Action impossible",
      }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(next);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Changer la catégorie de cette annonce"
          className="text-xs bg-[#f2f4f6] text-[#464652] px-2.5 py-1 rounded-full font-medium hover:bg-[#e3e8ee]"
        >
          {label}
          {saved.subcategory ? ` · ${saved.subcategory}` : ""}
          <span className="material-symbols-outlined text-[12px] ml-1 align-middle">edit</span>
        </button>
        {error && <span className="text-[10px] text-[#ba1a1a]">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[190px]">
      <select
        value={cat}
        onChange={(e) => {
          setCat(e.target.value);
          // La sous-catégorie de l'ancienne rubrique n'a plus de sens.
          setSub("");
        }}
        className="rounded-lg border border-[#eceef0] px-2 py-1.5 text-xs font-medium"
      >
        {CATEGORIES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>

      <select
        value={sub}
        onChange={(e) => setSub(e.target.value)}
        className="rounded-lg border border-[#eceef0] px-2 py-1.5 text-xs"
      >
        <option value="">Sans sous-catégorie</option>
        {(current?.subcategories ?? []).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-full bg-[#2f6fb8] px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50"
        >
          {pending ? "…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setCat(saved.category);
            setSub(saved.subcategory ?? "");
            setError("");
          }}
          className="text-[11px] font-bold text-[#777683]"
        >
          Annuler
        </button>
      </div>
      {error && <span className="text-[10px] text-[#ba1a1a]">{error}</span>}
    </div>
  );
}

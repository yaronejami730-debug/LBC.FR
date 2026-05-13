"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateClientDisplayName } from "@/app/admin/actions";

export default function DisplayNameEditor({
  userId,
  initialName,
}: {
  userId: string;
  initialName: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    if (!value.trim()) {
      setError("Le nom ne peut pas être vide");
      return;
    }
    setSaving(true);
    try {
      await updateClientDisplayName(userId, value.trim());
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-[#777683]">Nom affiché sur les annonces :</span>
        <span className="text-sm font-bold text-[#191c1e]">{initialName || "(non défini)"}</span>
        <button
          type="button"
          onClick={() => {
            setValue(initialName ?? "");
            setEditing(true);
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#e8f0fb] text-[#2f6fb8] text-[11px] font-bold hover:bg-[#d5e3fc] transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">edit</span>
          Modifier
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <label className="block text-xs font-bold uppercase tracking-widest text-[#777683]">
        Nom affiché sur les annonces
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Garage Mechel, Sylvie Mechel Auto…"
          autoFocus
          className="flex-1 px-3 py-2 rounded-lg border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-[#2f6fb8] text-white text-xs font-bold hover:bg-[#2f6fb8]/90 transition-colors disabled:opacity-50"
        >
          {saving ? "…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError("");
          }}
          className="px-4 py-2 rounded-lg bg-white text-[#191c1e] text-xs font-bold border border-[#eceef0] hover:bg-[#f7f9fb] transition-colors"
        >
          Annuler
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 font-semibold">{error}</p>
      )}
      <p className="text-[10px] text-[#9ca3af]">
        Ce nom remplace le prénom et le nom personnel sur toutes les annonces du compte.
      </p>
    </div>
  );
}

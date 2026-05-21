"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateUserPhone } from "@/app/admin/actions";

export default function PhoneEditor({
  userId,
  initialPhone,
}: {
  userId: string;
  initialPhone: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialPhone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      await updateUserPhone(userId, value.trim() || null);
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
        <span className="text-xs font-semibold text-[#777683]">Numéro de téléphone du compte :</span>
        <span className="text-sm font-bold text-[#191c1e]">
          {initialPhone || <span className="text-[#c7c5d4] font-normal">(non défini)</span>}
        </span>
        <button
          type="button"
          onClick={() => {
            setValue(initialPhone ?? "");
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
        Numéro de téléphone du compte
      </label>
      <div className="flex gap-2 flex-wrap">
        <input
          type="tel"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="06 12 34 56 78"
          autoFocus
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
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
        Ce numéro est appliqué à toutes les annonces du compte. Un même numéro ne peut pas être utilisé par deux comptes — toute saisie en doublon est refusée.
      </p>
    </div>
  );
}

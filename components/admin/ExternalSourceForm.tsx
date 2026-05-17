"use client";

import { useState, useTransition } from "react";
import { addExternalSource } from "@/app/admin/actions";

export default function ExternalSourceForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setOk(false);
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;
    startTransition(async () => {
      try {
        await addExternalSource(formData);
        setOk(true);
        form.reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-[#eceef0] p-6 space-y-4"
    >
      <h2 className="font-bold text-[#191c1e]">Ajouter une source</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
            Email du compte propriétaire
          </span>
          <input
            type="email"
            name="ownerEmail"
            required
            placeholder="s.mekil@bskimmobilier.com"
            className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-[#eceef0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30"
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
            Libellé
          </span>
          <input
            type="text"
            name="label"
            required
            placeholder="Sylvie Mekil — BSK"
            className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-[#eceef0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
            URL de la page source
          </span>
          <input
            type="url"
            name="url"
            required
            placeholder="https://bskimmobilier.com/sylvie-mekil-8374"
            className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-[#eceef0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30"
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
            Connecteur
          </span>
          <select
            name="kind"
            defaultValue="bsk"
            className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-[#eceef0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30"
          >
            <option value="bsk">BSK Immobilier</option>
          </select>
        </label>
      </div>

      {error && (
        <p className="text-sm text-[#ba1a1a] bg-[#ffdad6] rounded-xl px-4 py-2.5">{error}</p>
      )}
      {ok && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5">
          Source ajoutée.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 bg-[#2f6fb8] text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#255a96] disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
        {isPending ? "Ajout en cours…" : "Ajouter la source"}
      </button>
    </form>
  );
}

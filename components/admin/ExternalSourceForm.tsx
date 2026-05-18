"use client";

import { useEffect, useState, useTransition } from "react";
import { addExternalSource } from "@/app/admin/actions";
import UserPicker, { userDisplayName, type UserOption } from "@/components/admin/UserPicker";

export default function ExternalSourceForm() {
  const [selectedOwner, setSelectedOwner] = useState<UserOption | null>(null);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [labelTouched, setLabelTouched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  // Préremplit le libellé avec le nom du compte sélectionné (modifiable).
  useEffect(() => {
    if (selectedOwner && !labelTouched) {
      setLabel(userDisplayName(selectedOwner));
    }
  }, [selectedOwner, labelTouched]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setOk(false);
    if (!selectedOwner) {
      setError("Sélectionne un compte propriétaire.");
      return;
    }
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;
    startTransition(async () => {
      try {
        await addExternalSource(formData);
        setOk(true);
        form.reset();
        setSelectedOwner(null);
        setLabel("");
        setUrl("");
        setLabelTouched(false);
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
      <h2 className="font-bold text-[#191c1e]">Ajouter une source (page agence)</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
            Compte propriétaire
          </span>
          <UserPicker selected={selectedOwner} onSelect={setSelectedOwner} />
        </div>

        <label className="block md:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
            Libellé public
          </span>
          <input
            type="text"
            name="label"
            required
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setLabelTouched(true);
            }}
            placeholder="BSK Paris 17, Century 21 Marseille Prado…"
            className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-[#eceef0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30"
          />
          <p className="text-[10px] text-[#777683] mt-1">
            Nom affiché aux utilisateurs sur les annonces importées.
          </p>
        </label>

        <label className="block md:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
            URL source (agence / franchisé)
          </span>
          <input
            type="url"
            name="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://bskimmobilier.com/sylvie-mekil-8374"
            className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-[#eceef0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30"
          />
          <p className="text-[10px] text-[#777683] mt-1">
            Le scraper crawle uniquement ce slug d&apos;agence — jamais le reste du domaine.
          </p>
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

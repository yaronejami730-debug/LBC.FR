"use client";

import { useState } from "react";
import { createClientAccount } from "@/app/admin/actions";

type CreatedClient = { userId: string; email: string; name: string };

export default function CreateClientForm({
  onCreated,
}: {
  onCreated: (client: CreatedClient) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const result = await createClientAccount(email.trim(), name.trim());
      setSuccess(`Compte créé et invitation envoyée à ${result.email}`);
      onCreated(result);
      setName("");
      setEmail("");
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5">
            Nom complet
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jean Dupont"
            required
            className="w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5">
            Adresse email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jean@exemple.fr"
            required
            className="w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
          />
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl border border-red-100">
          {error}
        </p>
      )}
      {success && (
        <p className="text-emerald-700 text-sm bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 px-6 py-3 bg-[#2f6fb8] text-white rounded-xl font-bold text-sm hover:bg-[#1a5a9e] transition-all disabled:opacity-60 shadow-md shadow-[#2f6fb8]/20 active:scale-95"
      >
        <span className="material-symbols-outlined text-[18px]">person_add</span>
        {loading ? "Création en cours…" : "Créer le compte & envoyer l'invitation"}
      </button>
    </form>
  );
}

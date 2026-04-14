"use client";

import { useState } from "react";
import { createListingForClient } from "@/app/admin/actions";
import { CATEGORIES } from "@/lib/categories";

const CONDITIONS = ["Neuf", "Très bon état", "Bon état", "État correct", "Pour pièces"];

export default function AdminListingForm({
  userId,
  userName,
  onDone,
}: {
  userId: string;
  userName: string;
  onDone: (listingId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [condition, setCondition] = useState("Bon état");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const subcategories =
    CATEGORIES.find((c) => c.label === category)?.subcategories ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError("Prix invalide");
      return;
    }

    setLoading(true);
    try {
      const result = await createListingForClient(userId, {
        title,
        price: parsedPrice,
        category,
        subcategory: subcategory || undefined,
        description,
        location,
        condition,
        images: [],
        phone: phone || undefined,
      });
      onDone(result.listingId);
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-[#464652] bg-blue-50 px-4 py-3 rounded-xl border border-blue-100 flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-blue-500" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
        Annonce créée au nom de <strong>{userName}</strong>. Elle sera immédiatement en ligne et un email de confirmation lui sera envoyé.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5">Titre</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: iPhone 14 Pro Max 256Go"
            required
            className="w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5">Prix (€)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            required
            className="w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5">État</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5">Catégorie</label>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setSubcategory(""); }}
            required
            className="w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
          >
            <option value="">Choisir…</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.label}>{c.label}</option>
            ))}
          </select>
        </div>

        {subcategories.length > 0 && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5">Sous-catégorie</label>
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
            >
              <option value="">Toutes</option>
              {subcategories.map((s: string) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5">Localisation</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Paris 75001"
            required
            className="w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5">Téléphone (optionnel)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="06 00 00 00 00"
            className="w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Décrivez l'article en détail…"
            required
            className="w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all resize-none"
          />
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl border border-red-100">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-[#2f6fb8] text-white rounded-xl font-bold text-sm hover:bg-[#1a5a9e] transition-all disabled:opacity-60 shadow-md shadow-[#2f6fb8]/20 active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">publish</span>
          {loading ? "Publication…" : "Publier l'annonce"}
        </button>
      </div>
    </form>
  );
}

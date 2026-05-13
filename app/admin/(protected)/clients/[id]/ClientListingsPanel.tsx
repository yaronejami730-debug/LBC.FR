"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { updateListingByAdmin } from "@/app/admin/actions";

const CONDITIONS = ["Neuf", "Très bon état", "Bon état", "État correct", "Pour pièces"];
const MAX_PHOTOS = 15;

type Listing = {
  id: string;
  title: string;
  price: number;
  category: string;
  subcategory: string | null;
  description: string;
  location: string;
  condition: string;
  images: string[];
  phone: string | null;
  hidePhone: boolean;
  status: string;
  createdAt: string;
};

export default function ClientListingsPanel({ listings }: { listings: Listing[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {listings.map((l) => (
        <ListingCard
          key={l.id}
          listing={l}
          isEditing={editingId === l.id}
          onEdit={() => setEditingId(l.id)}
          onCancel={() => setEditingId(null)}
          onSaved={() => setEditingId(null)}
        />
      ))}
    </div>
  );
}

function ListingCard({
  listing,
  isEditing,
  onEdit,
  onCancel,
  onSaved,
}: {
  listing: Listing;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  if (isEditing) {
    return <EditForm listing={listing} onCancel={onCancel} onSaved={onSaved} />;
  }

  const cover = listing.images[0];

  return (
    <article className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
      <div className="relative aspect-[16/10] bg-[#f2f4f6]">
        {cover ? (
          <Image
            src={cover}
            alt={listing.title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-[#c7c5d4]">image</span>
          </div>
        )}
        <span className={`absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
          listing.status === "APPROVED"
            ? "bg-emerald-50 text-emerald-700"
            : listing.status === "PENDING"
            ? "bg-amber-50 text-amber-700"
            : "bg-slate-100 text-slate-600"
        }`}>
          {listing.status}
        </span>
        {listing.images.length > 1 && (
          <span className="absolute bottom-2 right-2 text-[10px] font-bold bg-black/60 text-white px-2 py-0.5 rounded-full">
            {listing.images.length} photos
          </span>
        )}
      </div>

      <div className="p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
          {listing.category}
          {listing.subcategory ? ` · ${listing.subcategory}` : ""}
        </p>
        <h3 className="text-sm font-bold text-[#191c1e] mt-1 line-clamp-2">
          {listing.title}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <p className="text-base font-extrabold text-[#2f6fb8]">
            {listing.price.toLocaleString("fr-FR")} €
          </p>
          <p className="text-xs text-[#777683] truncate ml-2 max-w-[50%]">
            {listing.location}
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[#e8f0fb] text-[#2f6fb8] hover:bg-[#d5e3fc] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
            Modifier
          </button>
          <a
            href={`/annonce/${listing.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-[#777683] hover:text-[#2f6fb8] hover:bg-[#f7f9fb] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            Voir
          </a>
        </div>
      </div>
    </article>
  );
}

function EditForm({
  listing,
  onCancel,
  onSaved,
}: {
  listing: Listing;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(listing.title);
  const [price, setPrice] = useState(String(listing.price));
  const [description, setDescription] = useState(listing.description);
  const [location, setLocation] = useState(listing.location);
  const [condition, setCondition] = useState(listing.condition || "Bon état");
  const [phone, setPhone] = useState(listing.phone ?? "");
  const [hidePhone, setHidePhone] = useState(listing.hidePhone);
  const [images, setImages] = useState<string[]>(listing.images);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (images.length >= MAX_PHOTOS) {
      setError(`Maximum ${MAX_PHOTOS} photos`);
      return;
    }
    setUploading(true);
    setError("");
    try {
      const remaining = MAX_PHOTOS - images.length;
      const uploads: string[] = [];
      for (const file of Array.from(files).slice(0, remaining)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) throw new Error("Erreur d'envoi");
        const data = await res.json();
        if (!data.url) throw new Error("Réponse invalide");
        uploads.push(data.url);
      }
      setImages((prev) => [...prev, ...uploads]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur upload");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveImage(idx: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError("Prix invalide");
      return;
    }
    if (!title.trim()) {
      setError("Titre obligatoire");
      return;
    }
    setSaving(true);
    try {
      await updateListingByAdmin(listing.id, {
        title: title.trim(),
        price: parsedPrice,
        description: description.trim(),
        location: location.trim(),
        condition,
        phone: phone.trim() || null,
        hidePhone,
        images,
      });
      onSaved();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="md:col-span-2 bg-white rounded-2xl border border-[#2f6fb8]/30 overflow-hidden ring-2 ring-[#2f6fb8]/20"
    >
      <div className="px-5 py-3.5 border-b border-[#eceef0] bg-[#f8f9fb] flex items-center gap-2">
        <span className="material-symbols-outlined text-[#2f6fb8] text-[18px]">edit</span>
        <h3 className="text-sm font-bold text-[#191c1e] uppercase tracking-wide">
          Modifier l'annonce
        </h3>
        <span className="ml-auto text-xs text-[#777683]">ID {listing.id.slice(0, 8)}</span>
      </div>

      <div className="p-5 space-y-5">
        {/* Photos */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-2">
            Photos ({images.length}/{MAX_PHOTOS})
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {images.map((src, idx) => (
              <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-[#eceef0] group">
                <Image src={src} alt={`Photo ${idx + 1}`} fill sizes="120px" className="object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="px-2 py-1 rounded text-[10px] font-bold bg-red-500 text-white hover:bg-red-600"
                  >
                    Supprimer
                  </button>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveImage(idx, -1)}
                      disabled={idx === 0}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-white/90 text-[#191c1e] disabled:opacity-40"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => moveImage(idx, 1)}
                      disabled={idx === images.length - 1}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-white/90 text-[#191c1e] disabled:opacity-40"
                    >
                      →
                    </button>
                  </div>
                </div>
                {idx === 0 && (
                  <span className="absolute top-1 left-1 text-[9px] font-bold bg-[#2f6fb8] text-white px-1.5 py-0.5 rounded">
                    1ère
                  </span>
                )}
              </div>
            ))}
            {images.length < MAX_PHOTOS && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-[#c7c5d4] flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-[#2f6fb8] hover:bg-[#e8f0fb]/30 transition-colors">
                <span className="material-symbols-outlined text-2xl text-[#777683]">
                  {uploading ? "hourglass_empty" : "add_a_photo"}
                </span>
                <span className="text-[10px] text-[#777683] font-semibold">
                  {uploading ? "Envoi…" : "Ajouter"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => handleUpload(e.target.files)}
                />
              </label>
            )}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5">
            Titre
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
          />
        </div>

        {/* Price + condition */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5">
              Prix (€)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5">
              État
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5">
            Localisation
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            required
            className="w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all resize-y"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5">
            Téléphone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="06 12 34 56 78"
            className="w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
          />
          <label className="flex items-center gap-2 mt-2 text-xs text-[#777683]">
            <input
              type="checkbox"
              checked={hidePhone}
              onChange={(e) => setHidePhone(e.target.checked)}
              className="w-4 h-4 accent-[#2f6fb8]"
            />
            Masquer le téléphone dans l'annonce
          </label>
        </div>

        {error && (
          <p className="text-red-600 text-sm font-medium bg-red-50 px-4 py-3 rounded-xl">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-[#eceef0]">
          <button
            type="submit"
            disabled={saving || uploading}
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-[#2f6fb8] text-white text-sm font-bold hover:bg-[#2f6fb8]/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-lg bg-white text-[#191c1e] text-sm font-bold border border-[#eceef0] hover:bg-[#f7f9fb] transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </form>
  );
}

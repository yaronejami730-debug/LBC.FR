"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";

const CONDITIONS = ["Neuf", "Très bon état", "Bon état", "État correct", "Pour pièces"];
const FUELS = ["Essence", "Diesel", "Hybride", "Électrique", "GPL", "Autre"];
const TRANSMISSIONS = ["Manuelle", "Automatique"];

type VehicleFields = {
  marque: string; modele: string; annee: string; kilometrage: string;
  carburant: string; transmission: string; couleur: string;
  immatriculation: string; puissanceFiscale: string; nombrePortes: string;
};

type Initial = {
  title: string; price: string; description: string; location: string;
  condition: string; category: string; subcategory: string;
  images: string[]; metadata: Record<string, string>;
};

export default function EditForm({ listingId, initial }: { listingId: string; initial: Initial }) {
  const router = useRouter();

  const matchedCategory = CATEGORIES.find((c) => c.label === initial.category);
  const categoryId = matchedCategory?.id ?? "maison";

  const [title, setTitle] = useState(initial.title);
  const [price, setPrice] = useState(initial.price);
  const [description, setDescription] = useState(initial.description);
  const [location, setLocation] = useState(initial.location);
  const [condition, setCondition] = useState(initial.condition);
  const [catId, setCatId] = useState(categoryId);
  const [subcategory, setSubcategory] = useState(initial.subcategory);
  const [images, setImages] = useState<string[]>(initial.images);
  const [vehicle, setVehicle] = useState<VehicleFields>({
    marque: initial.metadata.marque ?? "",
    modele: initial.metadata.modele ?? "",
    annee: initial.metadata.annee ?? "",
    kilometrage: initial.metadata.kilometrage ?? "",
    carburant: initial.metadata.carburant ?? "Essence",
    transmission: initial.metadata.transmission ?? "Manuelle",
    couleur: initial.metadata.couleur ?? "",
    immatriculation: initial.metadata.immatriculation ?? "",
    puissanceFiscale: initial.metadata.puissanceFiscale ?? "",
    nombrePortes: initial.metadata.nombrePortes ?? "5",
  });

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function setV(field: keyof VehicleFields, value: string) {
    setVehicle((v) => ({ ...v, [field]: value }));
  }

  async function handleImageUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploads: string[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (data.url) uploads.push(data.url);
      }
      setImages((prev) => [...prev, ...uploads].slice(0, 7));
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!title || !price || !description || !location) return;
    setSaving(true);
    setError(null);
    const activeCategory = CATEGORIES.find((c) => c.id === catId);
    const metadata = catId === "vehicules" ? JSON.stringify(vehicle) : "{}";
    try {
      const res = await fetch(`/api/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, price: parseFloat(price), description, location, condition,
          category: activeCategory?.label ?? initial.category,
          subcategory, images, metadata,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Erreur lors de la sauvegarde");
        return;
      }
      router.push(`/annonce/${listingId}`);
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface-container-low text-on-surface antialiased pb-32">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl fixed top-0 w-full z-50 shadow-[0_16px_32px_rgba(21,21,125,0.06)]">
        <div className="flex items-center justify-between px-6 py-4 w-full max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href={`/annonce/${listingId}`} className="text-primary p-2 hover:bg-slate-50 rounded-full active:scale-95 transition-transform">
              <span className="material-symbols-outlined">close</span>
            </Link>
            <img src="/logo.png" alt="Le Bon Deal" className="h-12 w-auto" />
          </div>
          <span className="font-['Manrope'] font-bold text-base tracking-tight text-primary">Modifier l'annonce</span>
        </div>
        <div className="bg-slate-100/50 h-[1px]" />
      </header>

      <main className="max-w-3xl mx-auto pt-32 px-6 space-y-10">
        {/* Photos */}
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <h3 className="text-lg font-bold text-on-surface">Photos</h3>
            <span className="text-sm text-outline">{images.length} / 7</span>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {images.map((img, i) => (
              <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-surface-container-highest">
                <img src={img} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-red-500/60 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 text-[8px] font-bold text-white bg-black/40 px-1.5 py-0.5 rounded">Principale</span>
                )}
              </div>
            ))}
            {images.length < 7 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="aspect-square rounded-xl border-2 border-dashed border-outline-variant hover:border-primary transition-all flex flex-col items-center justify-center gap-1 bg-surface-container-highest"
              >
                {uploading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-primary text-2xl">add_photo_alternate</span>
                    <span className="text-[10px] font-bold text-primary">Ajouter</span>
                  </>
                )}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => handleImageUpload(e.target.files)} />
        </section>

        {/* Champs */}
        <section className="space-y-8 bg-surface-container-lowest p-6 rounded-2xl shadow-sm">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-primary tracking-widest uppercase">Titre</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent border-none p-0 text-2xl font-['Manrope'] font-semibold text-on-surface placeholder:text-outline-variant focus:ring-0 outline-none"
              placeholder="Titre de l'annonce" />
            <div className="h-[2px] bg-surface-container" />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-primary tracking-widest uppercase">Prix</label>
            <div className="flex items-baseline gap-2">
              <input value={price} onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-transparent border-none p-0 text-4xl font-['Manrope'] font-extrabold text-on-surface placeholder:text-outline-variant focus:ring-0 outline-none"
                placeholder="0" type="number" min="0" />
              <span className="text-3xl font-['Manrope'] font-bold text-on-surface-variant">€</span>
            </div>
            <div className="h-[2px] bg-surface-container" />
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-bold text-primary tracking-widest uppercase">Catégorie</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat.id} type="button"
                  onClick={() => { setCatId(cat.id); setSubcategory(cat.subcategories[0]); }}
                  className={`px-3 py-3 rounded-2xl flex flex-col items-center gap-2 transition-all border ${catId === cat.id ? "bg-primary/5 border-primary text-primary" : "bg-white border-slate-100 text-slate-500 hover:border-slate-300"}`}
                >
                  <span className="material-symbols-outlined text-2xl">{cat.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-tight text-center">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-primary tracking-widest uppercase">Sous-catégorie</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.find((c) => c.id === catId)?.subcategories.map((sub) => (
                <button key={sub} type="button" onClick={() => setSubcategory(sub)}
                  className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${subcategory === sub ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary"}`}>
                  {sub}
                </button>
              ))}
            </div>
          </div>

          {catId === "vehicules" && (
            <div className="space-y-6 border-t border-surface-container pt-6">
              <p className="text-xs font-bold text-primary tracking-widest uppercase">Caractéristiques du véhicule</p>
              <div className="grid grid-cols-2 gap-4">
                {(["marque", "modele", "annee", "kilometrage", "couleur", "immatriculation", "puissanceFiscale"] as const).map((field) => (
                  <div key={field} className="space-y-1">
                    <label className="text-xs font-semibold text-outline uppercase tracking-wider">{field}</label>
                    <input value={vehicle[field]} onChange={(e) => setV(field, e.target.value)}
                      className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-base text-on-surface outline-none focus:ring-2 focus:ring-primary border-none" />
                  </div>
                ))}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-outline uppercase tracking-wider">Carburant</label>
                  <div className="flex flex-wrap gap-1.5">
                    {FUELS.map((f) => (
                      <button key={f} type="button" onClick={() => setV("carburant", f)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${vehicle.carburant === f ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-outline uppercase tracking-wider">Boîte</label>
                  <div className="flex gap-2">
                    {TRANSMISSIONS.map((t) => (
                      <button key={t} type="button" onClick={() => setV("transmission", t)}
                        className={`flex-1 py-2 rounded-full text-xs font-semibold transition-all ${vehicle.transmission === t ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-bold text-primary tracking-widest uppercase">Localisation</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-transparent border-none p-0 text-xl font-['Manrope'] font-semibold text-on-surface placeholder:text-outline-variant focus:ring-0 outline-none"
              placeholder="Ville, Département" />
            <div className="h-[2px] bg-surface-container" />
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-primary tracking-widest uppercase">État</label>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((c) => (
                <button key={c} type="button" onClick={() => setCondition(c)}
                  className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${condition === c ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant hover:bg-primary hover:text-white"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-primary tracking-widest uppercase">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-transparent border-none p-0 text-base text-on-surface placeholder:text-outline-variant focus:ring-0 leading-relaxed resize-none outline-none"
              placeholder="Décrivez votre article…" rows={6} />
            <div className="h-[1px] bg-surface-container" />
          </div>
        </section>
      </main>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-2xl z-50 px-6 py-4 border-t border-outline-variant/10">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
          <div className="flex gap-3">
            <Link
              href={`/annonce/${listingId}`}
              className="px-6 py-4 rounded-full border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all"
            >
              Annuler
            </Link>
            <button
              onClick={handleSave}
              disabled={saving || !title || !price || !description || !location}
              className="flex-1 bg-gradient-to-r from-primary to-primary-container text-white font-['Manrope'] font-bold py-4 rounded-full shadow-[0_16px_32px_rgba(21,21,125,0.2)] active:scale-95 transition-all disabled:opacity-60"
            >
              {saving ? "Enregistrement…" : "Enregistrer les modifications"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

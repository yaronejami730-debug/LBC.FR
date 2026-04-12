"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CATEGORIES = ["Électronique", "Véhicules", "Meubles", "Immobilier", "Loisirs", "Mode", "Emplois"];
const CONDITIONS = ["Neuf", "Très bon état", "Bon état", "État correct", "Pour pièces"];
const FUELS = ["Essence", "Diesel", "Hybride", "Électrique", "GPL", "Autre"];
const TRANSMISSIONS = ["Manuelle", "Automatique"];

const FREE_PHOTOS = 3;
// 0.99 € per pack of 2 extra photos
function extraCost(count: number) {
  const extra = Math.max(0, count - FREE_PHOTOS);
  if (extra === 0) return 0;
  return Math.ceil(extra / 2) * 0.99;
}

type VehicleFields = {
  marque: string;
  modele: string;
  annee: string;
  kilometrage: string;
  carburant: string;
  transmission: string;
  couleur: string;
  immatriculation: string;
  puissanceFiscale: string;
  nombrePortes: string;
};

export default function PostForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Électronique");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [condition, setCondition] = useState("Bon état");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [photoPaywall, setPhotoPaywall] = useState(false); // show upsell when > 3 photos
  const [publishError, setPublishError] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<VehicleFields>({
    marque: "", modele: "", annee: "", kilometrage: "",
    carburant: "Essence", transmission: "Manuelle",
    couleur: "", immatriculation: "", puissanceFiscale: "", nombrePortes: "5",
  });

  const mainFileRef = useRef<HTMLInputElement>(null);
  const extraFileRef = useRef<HTMLInputElement>(null);

  function setV(field: keyof VehicleFields, value: string) {
    setVehicle((v) => ({ ...v, [field]: value }));
  }

  async function handleImageUpload(files: FileList | null, slotIndex?: number) {
    if (!files || files.length === 0) return;

    // Check if this would exceed 3 free photos
    const pending = images.length + files.length;
    if (images.length >= FREE_PHOTOS && !photoPaywall) {
      setPhotoPaywall(true);
      return;
    }

    setUploading(true);
    try {
      const uploads: string[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        uploads.push(data.url);
      }
      if (slotIndex !== undefined) {
        setImages((prev) => {
          const next = [...prev];
          next[slotIndex] = uploads[0];
          return next;
        });
      } else {
        setImages((prev) => [...prev, ...uploads].slice(0, 7)); // max 7 with paid
      }
    } finally {
      setUploading(false);
    }
  }

  async function handlePublish() {
    if (!title || !price || !description || !location) return;
    setPublishing(true);
    setPublishError(null);
    const metadata = category === "Véhicules" ? JSON.stringify(vehicle) : "{}";
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, price: parseFloat(price), category, description, location, condition, images, metadata }),
      });
      if (res.status === 401) {
        router.push("/login?callbackUrl=/post");
        return;
      }
      // Safe JSON parse — server might return HTML on unexpected errors
      const text = await res.text();
      let data: { id?: string; error?: string } = {};
      try { data = JSON.parse(text); } catch { /* HTML 500 page */ }

      if (!res.ok) {
        setPublishError(data.error || `Erreur serveur (${res.status}). Consultez la console pour les détails.`);
        return;
      }
      if (!data.id) {
        setPublishError("Réponse inattendue du serveur. Réessayez.");
        return;
      }
      router.push(`/listing/${data.id}`);
    } catch (err) {
      console.error("[handlePublish]", err);
      setPublishError("Impossible de joindre le serveur. Vérifiez votre connexion.");
    } finally {
      setPublishing(false);
    }
  }

  const cost = extraCost(images.length);

  return (
    <div className="bg-surface-container-low text-on-surface antialiased pb-32">
      {/* TopAppBar */}
      <header className="bg-white/80 backdrop-blur-xl fixed top-0 w-full z-50 shadow-[0_16px_32px_rgba(21,21,125,0.06)]">
        <div className="flex items-center justify-between px-6 py-4 w-full max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-primary active:scale-95 transition-transform p-2 hover:bg-slate-50 rounded-full">
              <span className="material-symbols-outlined">close</span>
            </Link>
            <h1 className="text-2xl font-extrabold text-primary tracking-tighter font-['Manrope']">PrèsDeToi</h1>
          </div>
          <span className="font-['Manrope'] font-bold text-base tracking-tight text-primary">Nouvelle annonce</span>
        </div>
        <div className="bg-slate-100/50 h-[1px]" />
      </header>

      <main className="max-w-3xl mx-auto pt-24 px-6">
        <div className="space-y-10">
          <section className="space-y-1">
            <p className="text-sm font-semibold text-primary uppercase tracking-[0.05em]">Pour commencer</p>
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">Déposez votre annonce</h2>
            <p className="text-on-surface-variant">Créez une annonce de qualité pour toucher des milliers d'acheteurs.</p>
          </section>

          {/* ── PHOTOS ────────────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-lg font-bold text-on-surface">Photos</h3>
                <p className="text-xs text-outline mt-0.5">3 gratuites · +2 photos = 0,99 € · +4 photos = 1,98 €</p>
              </div>
              <span className={`text-sm font-bold ${images.length >= FREE_PHOTOS ? "text-primary" : "text-outline"}`}>
                {images.length} / {images.length > FREE_PHOTOS ? "7 max" : "3 gratuites"}
              </span>
            </div>

            {/* Grid de photos */}
            <div className="grid grid-cols-4 gap-3 h-52 md:h-64">
              {/* Slot principal */}
              <button
                type="button"
                onClick={() => {
                  if (images.length === 0 || !images[0]) mainFileRef.current?.click();
                }}
                className="col-span-2 row-span-2 relative group overflow-hidden rounded-xl bg-surface-container-highest flex flex-col items-center justify-center border-2 border-dashed border-outline-variant hover:border-primary transition-all"
              >
                {images[0] ? (
                  <>
                    <img src={images[0]} alt="Photo principale" className="w-full h-full object-cover absolute inset-0" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-primary text-4xl mb-2">camera</span>
                    <p className="font-bold text-primary text-sm">{uploading ? "Envoi…" : "Photo principale"}</p>
                  </>
                )}
              </button>

              {/* Slots secondaires */}
              {[1, 2, 3, 4].map((i) => {
                const isPaid = i >= FREE_PHOTOS;
                const isLocked = isPaid && images.length < FREE_PHOTOS;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (isLocked) { setPhotoPaywall(true); return; }
                      extraFileRef.current?.click();
                    }}
                    className={`relative group overflow-hidden rounded-xl flex items-center justify-center border transition-all
                      ${isLocked ? "bg-surface-container border-outline-variant/20 opacity-60" : "bg-surface-container-highest border-outline-variant/30 hover:border-primary"}`}
                  >
                    {images[i] ? (
                      <img src={images[i]} alt={`Photo ${i + 1}`} className="w-full h-full object-cover absolute inset-0" />
                    ) : isLocked ? (
                      <span className="material-symbols-outlined text-outline/40 text-xl">lock</span>
                    ) : (
                      <span className="material-symbols-outlined text-outline text-xl">add</span>
                    )}
                    {isPaid && !images[i] && !isLocked && (
                      <span className="absolute bottom-1 right-1 text-[8px] font-bold text-primary bg-white/80 px-1 rounded">+</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Upsell banner */}
            {(photoPaywall || images.length >= FREE_PHOTOS) && (
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-primary text-sm">Ajoutez plus de photos</p>
                  <p className="text-outline text-xs mt-0.5">
                    +2 photos : <span className="font-bold text-on-surface">0,99 €</span> · +4 photos : <span className="font-bold text-on-surface">1,98 €</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setPhotoPaywall(false); extraFileRef.current?.click(); }}
                  className="flex-shrink-0 px-4 py-2 bg-primary text-white rounded-full text-sm font-bold active:scale-95 transition-transform"
                >
                  Débloquer (0,99 €)
                </button>
              </div>
            )}

            <input ref={mainFileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => handleImageUpload(e.target.files, 0)} />
            <input ref={extraFileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => handleImageUpload(e.target.files)} />
          </section>

          {/* ── CHAMPS PRINCIPAUX ─────────────────────────────────── */}
          <section className="space-y-8 bg-surface-container-lowest p-6 rounded-2xl shadow-sm">
            {/* Titre */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-primary tracking-widest uppercase">Titre</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent border-none p-0 text-2xl font-['Manrope'] font-semibold text-on-surface placeholder:text-outline-variant focus:ring-0 outline-none"
                placeholder="Que vendez-vous ?" type="text" />
              <div className="h-[2px] bg-surface-container" />
            </div>

            {/* Prix */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-primary tracking-widest uppercase">Prix</label>
              <div className="flex items-baseline gap-2">
                <input value={price} onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-transparent border-none p-0 text-4xl font-['Manrope'] font-extrabold text-on-surface placeholder:text-outline-variant focus:ring-0 outline-none"
                  placeholder="0" type="number" min="0" step="1" />
                <span className="text-3xl font-['Manrope'] font-bold text-on-surface-variant">€</span>
              </div>
              <div className="h-[2px] bg-surface-container" />
            </div>

            {/* Catégorie */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-primary tracking-widest uppercase">Catégorie</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button key={cat} type="button" onClick={() => setCategory(cat)}
                    className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${category === cat ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant hover:bg-primary hover:text-white"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* ── CHAMPS VÉHICULES ─────────────────────────────── */}
            {category === "Véhicules" && (
              <div className="space-y-6 border-t border-surface-container pt-6">
                <p className="text-xs font-bold text-primary tracking-widest uppercase">Caractéristiques du véhicule</p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-outline uppercase tracking-wider">Marque</label>
                    <input value={vehicle.marque} onChange={(e) => setV("marque", e.target.value)}
                      className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary border-none"
                      placeholder="Ex : Renault, BMW…" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-outline uppercase tracking-wider">Modèle</label>
                    <input value={vehicle.modele} onChange={(e) => setV("modele", e.target.value)}
                      className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary border-none"
                      placeholder="Ex : Clio, Série 3…" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-outline uppercase tracking-wider">Année</label>
                    <input value={vehicle.annee} onChange={(e) => setV("annee", e.target.value)}
                      className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary border-none"
                      placeholder="Ex : 2021" type="number" min="1900" max="2026" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-outline uppercase tracking-wider">Kilométrage</label>
                    <div className="relative">
                      <input value={vehicle.kilometrage} onChange={(e) => setV("kilometrage", e.target.value)}
                        className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary border-none pr-10"
                        placeholder="Ex : 45000" type="number" min="0" />
                      <span className="absolute right-3 top-2.5 text-xs text-outline font-medium">km</span>
                    </div>
                  </div>
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
                    <label className="text-xs font-semibold text-outline uppercase tracking-wider">Boîte de vitesses</label>
                    <div className="flex gap-2">
                      {TRANSMISSIONS.map((t) => (
                        <button key={t} type="button" onClick={() => setV("transmission", t)}
                          className={`flex-1 py-2 rounded-full text-xs font-semibold transition-all ${vehicle.transmission === t ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-outline uppercase tracking-wider">Couleur</label>
                    <input value={vehicle.couleur} onChange={(e) => setV("couleur", e.target.value)}
                      className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary border-none"
                      placeholder="Ex : Gris, Blanc…" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-outline uppercase tracking-wider">Nombre de portes</label>
                    <div className="flex gap-2">
                      {["2", "3", "4", "5"].map((n) => (
                        <button key={n} type="button" onClick={() => setV("nombrePortes", n)}
                          className={`flex-1 py-2 rounded-full text-xs font-semibold transition-all ${vehicle.nombrePortes === n ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-outline uppercase tracking-wider">Puissance fiscale</label>
                    <div className="relative">
                      <input value={vehicle.puissanceFiscale} onChange={(e) => setV("puissanceFiscale", e.target.value)}
                        className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary border-none pr-8"
                        placeholder="Ex : 7" type="number" min="1" />
                      <span className="absolute right-3 top-2.5 text-xs text-outline font-medium">CV</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-outline uppercase tracking-wider">Immatriculation</label>
                    <input value={vehicle.immatriculation} onChange={(e) => setV("immatriculation", e.target.value.toUpperCase())}
                      className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-sm font-mono text-on-surface outline-none focus:ring-2 focus:ring-primary border-none tracking-widest"
                      placeholder="AB-123-CD" maxLength={10} />
                  </div>
                </div>
              </div>
            )}

            {/* Localisation */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-primary tracking-widest uppercase">Localisation</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-transparent border-none p-0 text-xl font-['Manrope'] font-semibold text-on-surface placeholder:text-outline-variant focus:ring-0 outline-none"
                placeholder="Ville, Département" type="text" />
              <div className="h-[2px] bg-surface-container" />
            </div>

            {/* État */}
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

            {/* Description */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-primary tracking-widest uppercase">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-transparent border-none p-0 text-sm text-on-surface placeholder:text-outline-variant focus:ring-0 leading-relaxed resize-none outline-none"
                placeholder="Décrivez votre article : état, âge, raison de la vente…"
                rows={6} />
              <div className="h-[1px] bg-surface-container" />
            </div>
          </section>

          <p className="text-xs text-outline text-center leading-relaxed px-8">
            En publiant, vous acceptez nos{" "}
            <a href="#" className="underline font-bold text-primary">Conditions d'utilisation</a> et{" "}
            <a href="#" className="underline font-bold text-primary">Règles de publication</a>.
          </p>
        </div>
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-2xl z-50 px-6 py-4 border-t border-outline-variant/10">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          {publishError && (
            <p className="text-red-500 text-sm font-medium text-center">{publishError}</p>
          )}
          <div className="flex items-center gap-4">
            {cost > 0 && (
              <span className="text-sm text-outline font-medium whitespace-nowrap">
                Total : <span className="text-primary font-bold">{cost.toFixed(2).replace(".", ",")} €</span>
              </span>
            )}
            <button
              onClick={handlePublish}
              disabled={publishing || !title || !price || !description || !location}
              className="flex-1 bg-gradient-to-r from-primary to-primary-container text-white font-['Manrope'] font-bold py-4 rounded-full shadow-[0_16px_32px_rgba(21,21,125,0.2)] active:scale-95 transition-all disabled:opacity-60"
            >
              {publishing ? "Publication…" : "Publier l'annonce"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

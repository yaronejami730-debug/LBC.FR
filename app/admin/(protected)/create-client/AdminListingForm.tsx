"use client";

import { useState, useRef } from "react";
import { createListingForClient } from "@/app/admin/actions";
import { CATEGORIES } from "@/lib/categories";

const CONDITIONS = ["Neuf", "Très bon état", "Bon état", "État correct", "Pour pièces"];
const FUELS = ["Essence", "Diesel", "Hybride", "Électrique", "GPL", "Autre"];
const TRANSMISSIONS = ["Manuelle", "Automatique"];
const MAX_PHOTOS = 15;

const IMMO_TYPES = ["Appartement", "Maison", "Villa", "Studio", "Loft", "Terrain", "Local commercial", "Bureau", "Garage", "Autre"];
const IMMO_FEATURES = ["Ascenseur", "Balcon", "Terrasse", "Jardin", "Piscine", "Cave", "Parking", "Digicode", "Gardien", "Interphone", "Double vitrage", "Cuisine équipée", "Dressing", "Cheminée", "Lumineux", "Calme", "Meublé", "Accessible PMR"];
const CHAUFFAGE_TYPES = ["Central", "Individuel", "Collectif"];
const CHAUFFAGE_MODES = ["Gaz", "Électrique", "Fioul", "Pompe à chaleur", "Bois", "Autre"];
const DPE_CLASSES = ["A", "B", "C", "D", "E", "F", "G"];

type VehicleFields = {
  marque: string; modele: string; annee: string; kilometrage: string;
  carburant: string; transmission: string; couleur: string;
  immatriculation: string; puissanceFiscale: string; nombrePortes: string;
};

type ImmobilierFields = {
  typeBien: string; nombrePieces: string; nombreChambres: string;
  nombreSallesEau: string; surface: string;
  caracteristiques: string[];
  typeCharuffe: string; modeCharuffe: string;
  etage: string; exposition: string;
  placesParking: string; anneeConstruction: string;
  etatBien: string; reference: string;
  classeEnergie: string; ges: string;
  vueMer: boolean; visAVis: boolean;
  prixHonorairesInclus: string;
  prixHonorairesExclus: string;
  honorairesAcquereur: string;
  taxeFonciere: string;
};

const fieldCls = "w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all";
const labelCls = "block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5";

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#eceef0] flex items-center gap-2 bg-[#f8f9fb]">
        <span className="material-symbols-outlined text-[#2f6fb8] text-[18px]">{icon}</span>
        <h3 className="text-sm font-bold text-[#191c1e] uppercase tracking-wide">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

export default function AdminListingForm({
  userId,
  userName,
  onDone,
}: {
  userId: string;
  userName: string;
  onDone: (listingId: string) => void;
}) {
  // ── Basic fields ─────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [condition, setCondition] = useState("Bon état");
  const [phone, setPhone] = useState("");
  const [hidePhone, setHidePhone] = useState(false);

  // ── Photos ───────────────────────────────────────────────────────────────────
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Vehicle fields ───────────────────────────────────────────────────────────
  const [vehicle, setVehicle] = useState<VehicleFields>({
    marque: "", modele: "", annee: "", kilometrage: "",
    carburant: "Essence", transmission: "Manuelle",
    couleur: "", immatriculation: "", puissanceFiscale: "", nombrePortes: "5",
  });

  // ── Immobilier fields ────────────────────────────────────────────────────────
  const [immo, setImmo] = useState<ImmobilierFields>({
    typeBien: "Appartement", nombrePieces: "", nombreChambres: "",
    nombreSallesEau: "", surface: "",
    caracteristiques: [],
    typeCharuffe: "", modeCharuffe: "",
    etage: "", exposition: "",
    placesParking: "", anneeConstruction: "",
    etatBien: "", reference: "",
    classeEnergie: "", ges: "",
    vueMer: false, visAVis: false,
    prixHonorairesInclus: "", prixHonorairesExclus: "",
    honorairesAcquereur: "", taxeFonciere: "",
  });

  // ── AI import state ──────────────────────────────────────────────────────────
  const [mode, setMode] = useState<"choose" | "ai" | "manual">("choose");
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  // ── Submit state ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cat = CATEGORIES.find((c) => c.id === categoryId);
  const subcategories = cat?.subcategories ?? [];
  const isVehicle = categoryId === "vehicules";
  const isImmo = categoryId === "immobilier";

  function setV(field: keyof VehicleFields, value: string) {
    setVehicle((v) => ({ ...v, [field]: value }));
  }
  function setI<K extends keyof ImmobilierFields>(field: K, value: ImmobilierFields[K]) {
    setImmo((v) => ({ ...v, [field]: value }));
  }
  // ── AI import handler ────────────────────────────────────────────────────────
  async function handleImport() {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError("");
    try {
      const res = await fetch("/api/admin/import-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Erreur inconnue");

      const d = json.data;

      // Fill basic fields
      if (d.title)       setTitle(d.title);
      if (d.price != null) setPrice(String(d.price));
      if (d.description) setDescription(d.description);
      if (d.location)    setLocation(d.location);
      if (d.condition)   setCondition(d.condition);
      if (d.phone)       setPhone(d.phone);

      // Category — map label to id
      if (d.category) {
        const found = CATEGORIES.find(
          (c) => c.label.toLowerCase() === d.category.toLowerCase()
        );
        if (found) { setCategoryId(found.id); setSubcategory(""); }
      }
      if (d.subcategory) setSubcategory(d.subcategory);

      // Vehicle fields
      if (d.vehicle) {
        setVehicle((prev) => ({
          ...prev,
          marque:          d.vehicle.marque          ?? prev.marque,
          modele:          d.vehicle.modele          ?? prev.modele,
          annee:           d.vehicle.annee           ? String(d.vehicle.annee) : prev.annee,
          kilometrage:     d.vehicle.kilometrage     ? String(d.vehicle.kilometrage) : prev.kilometrage,
          carburant:       d.vehicle.carburant       ?? prev.carburant,
          transmission:    d.vehicle.transmission    ?? prev.transmission,
          couleur:         d.vehicle.couleur         ?? prev.couleur,
          immatriculation: d.vehicle.immatriculation ?? prev.immatriculation,
          puissanceFiscale:d.vehicle.puissanceFiscale ? String(d.vehicle.puissanceFiscale) : prev.puissanceFiscale,
          nombrePortes:    d.vehicle.nombrePortes    ? String(d.vehicle.nombrePortes) : prev.nombrePortes,
        }));
      }

      // Immo fields
      if (d.immo) {
        setImmo((prev) => ({
          ...prev,
          typeBien:             d.immo.typeBien             ?? prev.typeBien,
          surface:              d.immo.surface              ? String(d.immo.surface) : prev.surface,
          nombrePieces:         d.immo.nombrePieces         ? String(d.immo.nombrePieces) : prev.nombrePieces,
          nombreChambres:       d.immo.nombreChambres       ? String(d.immo.nombreChambres) : prev.nombreChambres,
          nombreSallesEau:      d.immo.nombreSallesEau      ? String(d.immo.nombreSallesEau) : prev.nombreSallesEau,
          etage:                d.immo.etage                ? String(d.immo.etage) : prev.etage,
          exposition:           d.immo.exposition           ?? prev.exposition,
          typeCharuffe:         d.immo.typeCharuffe         ?? prev.typeCharuffe,
          modeCharuffe:         d.immo.modeCharuffe         ?? prev.modeCharuffe,
          placesParking:        d.immo.placesParking        ? String(d.immo.placesParking) : prev.placesParking,
          anneeConstruction:    d.immo.anneeConstruction    ? String(d.immo.anneeConstruction) : prev.anneeConstruction,
          etatBien:             d.immo.etatBien             ?? prev.etatBien,
          reference:            d.immo.reference            ?? prev.reference,
          classeEnergie:        d.immo.classeEnergie        ?? prev.classeEnergie,
          ges:                  d.immo.ges                  ?? prev.ges,
          vueMer:               d.immo.vueMer               ?? prev.vueMer,
          visAVis:              d.immo.visAVis              ?? prev.visAVis,
          caracteristiques:     Array.isArray(d.immo.caracteristiques) ? d.immo.caracteristiques : prev.caracteristiques,
          prixHonorairesInclus: d.immo.prixHonorairesInclus ? String(d.immo.prixHonorairesInclus) : prev.prixHonorairesInclus,
          prixHonorairesExclus: d.immo.prixHonorairesExclus ? String(d.immo.prixHonorairesExclus) : prev.prixHonorairesExclus,
          honorairesAcquereur:  d.immo.honorairesAcquereur  ? String(d.immo.honorairesAcquereur) : prev.honorairesAcquereur,
          taxeFonciere:         d.immo.taxeFonciere         ? String(d.immo.taxeFonciere) : prev.taxeFonciere,
        }));
      }

      setMode("manual"); // show the filled form
    } catch (err: any) {
      setImportError(err.message ?? "Une erreur est survenue");
    } finally {
      setImporting(false);
    }
  }

  function toggleCarac(item: string) {
    setImmo((v) => ({
      ...v,
      caracteristiques: v.caracteristiques.includes(item)
        ? v.caracteristiques.filter((c) => c !== item)
        : [...v.caracteristiques, item],
    }));
  }

  // ── Photo upload ─────────────────────────────────────────────────────────────
  async function handleImageUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploads: string[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) throw new Error("Erreur d'envoi");
        const data = await res.json();
        if (!data.url) throw new Error("Réponse invalide");
        uploads.push(data.url);
      }
      setImages((prev) => [...prev, ...uploads].slice(0, MAX_PHOTOS));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) { setError("Prix invalide"); return; }

    const metadata = isVehicle
      ? JSON.stringify(vehicle)
      : isImmo
      ? JSON.stringify({
          typeBien: immo.typeBien,
          rooms: immo.nombrePieces,
          chambres: immo.nombreChambres,
          sallesEau: immo.nombreSallesEau,
          surface: immo.surface,
          caracteristiques: immo.caracteristiques,
          typeCharuffe: immo.typeCharuffe,
          modeCharuffe: immo.modeCharuffe,
          etage: immo.etage,
          exposition: immo.exposition,
          placesParking: immo.placesParking,
          anneeConstruction: immo.anneeConstruction,
          etatBien: immo.etatBien,
          reference: immo.reference,
          classeEnergie: immo.classeEnergie,
          ges: immo.ges,
          vueMer: immo.vueMer,
          visAVis: immo.visAVis,
          prixHonorairesInclus: immo.prixHonorairesInclus,
          prixHonorairesExclus: immo.prixHonorairesExclus,
          honorairesAcquereur: immo.honorairesAcquereur,
          taxeFonciere: immo.taxeFonciere,
        })
      : "{}";

    setLoading(true);
    try {
      const result = await createListingForClient(userId, {
        title, price: parsedPrice,
        category: cat?.label || categoryId,
        subcategory: subcategory || undefined,
        description, location, condition,
        images: images.filter(Boolean),
        phone: phone || undefined,
        hidePhone,
        metadata,
      });
      onDone(result.listingId);
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  // ── Mode selector ────────────────────────────────────────────────────────────
  if (mode === "choose") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#464652] bg-blue-50 px-4 py-3 rounded-xl border border-blue-100 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-blue-500" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
          Annonce pour <strong>{userName}</strong> — choisissez comment la créer
        </p>

        <div className="grid grid-cols-1 gap-3">
          {/* AI import */}
          <button
            type="button"
            onClick={() => setMode("ai")}
            className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-[#2f6fb8]/5 to-[#2f6fb8]/10 border-2 border-[#2f6fb8]/20 hover:border-[#2f6fb8]/50 transition-all text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-[#2f6fb8] flex items-center justify-center shrink-0 shadow-md shadow-[#2f6fb8]/30 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-white text-2xl">auto_awesome</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-[#191c1e] text-base">Importer avec l&apos;IA</p>
              <p className="text-[#777683] text-sm mt-0.5">Collez un lien d&apos;annonce — Claude analyse la page et remplit tout automatiquement</p>
            </div>
            <span className="material-symbols-outlined text-[#2f6fb8] text-xl shrink-0">chevron_right</span>
          </button>

          {/* Manual */}
          <button
            type="button"
            onClick={() => setMode("manual")}
            className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-[#eceef0] hover:border-[#2f6fb8]/30 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-slate-500 text-2xl">edit_note</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-[#191c1e] text-base">Saisie manuelle</p>
              <p className="text-[#777683] text-sm mt-0.5">Remplissez le formulaire vous-même champ par champ</p>
            </div>
            <span className="material-symbols-outlined text-slate-400 text-xl shrink-0">chevron_right</span>
          </button>
        </div>
      </div>
    );
  }

  // ── AI import screen ──────────────────────────────────────────────────────────
  if (mode === "ai") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => { setMode("choose"); setImportError(""); }}
          className="flex items-center gap-1.5 text-sm text-[#2f6fb8] font-semibold hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Retour
        </button>

        <div className="bg-white rounded-2xl border border-[#eceef0] p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2f6fb8] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white text-xl">auto_awesome</span>
            </div>
            <div>
              <p className="font-bold text-[#191c1e]">Import IA</p>
              <p className="text-xs text-[#777683]">Claude analyse la page et pré-remplit le formulaire</p>
            </div>
          </div>

          <div>
            <label className={labelCls}>Lien de l&apos;annonce à importer</label>
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://www.leboncoin.fr/annonce/..."
              className={fieldCls}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleImport(); } }}
            />
            <p className="text-xs text-[#9ca3af] mt-1.5">
              Fonctionne avec LeBonCoin, SeLoger, PAP, Logic-Immo, La Centrale, AutoScout24…
            </p>
          </div>

          {importError && (
            <p className="text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl border border-red-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {importError}
            </p>
          )}

          <button
            type="button"
            onClick={handleImport}
            disabled={importing || !importUrl.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#2f6fb8] text-white rounded-xl font-bold text-sm hover:bg-[#1a5a9e] transition-all disabled:opacity-60 shadow-md shadow-[#2f6fb8]/20 active:scale-[0.99]"
          >
            {importing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Analyse en cours…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                Analyser et importer
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Info banner */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#464652] bg-blue-50 px-4 py-3 rounded-xl border border-blue-100 flex items-center gap-2 flex-1 mr-3">
          <span className="material-symbols-outlined text-[18px] text-blue-500" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
          Annonce créée au nom de <strong>{userName}</strong>. Elle sera immédiatement en ligne.
        </p>
        <button
          type="button"
          onClick={() => setMode("choose")}
          className="shrink-0 flex items-center gap-1.5 text-xs text-[#777683] hover:text-[#2f6fb8] font-semibold transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
          Changer
        </button>
      </div>

      {/* ── Photos ─────────────────────────────────────────────────────────── */}
      <Section title="Photos" icon="photo_camera">
        {/* Grid */}
        {images.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100">
                <img src={img} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 text-[8px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded">
                    Principale
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                >
                  <span className="w-8 h-8 rounded-full bg-red-500/80 text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload button */}
        {images.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full h-24 rounded-xl border-2 border-dashed border-[#2f6fb8]/30 hover:border-[#2f6fb8]/60 bg-blue-50/50 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 text-[#2f6fb8] disabled:opacity-50"
          >
            {uploading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-[3px] border-[#2f6fb8] border-t-transparent" />
            ) : (
              <>
                <span className="material-symbols-outlined text-2xl">add_a_photo</span>
                <span className="text-xs font-semibold">
                  {images.length === 0 ? "Ajouter des photos" : `Ajouter (${images.length}/${MAX_PHOTOS})`}
                </span>
              </>
            )}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { handleImageUpload(e.target.files); e.target.value = ""; }}
        />
      </Section>

      {/* ── Titre + Prix + État ──────────────────────────────────────────────── */}
      <Section title="Informations générales" icon="edit_note">
        <div>
          <label className={labelCls}>Titre de l&apos;annonce</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex : iPhone 14 Pro 256 Go · Audi A3 2020 · Appartement T3…"
            required
            className={fieldCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Prix (€)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              required
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls}>État</label>
            <select value={condition} onChange={(e) => setCondition(e.target.value)} className={fieldCls}>
              {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Catégorie</label>
            <select
              value={categoryId}
              onChange={(e) => { setCategoryId(e.target.value); setSubcategory(""); }}
              required
              className={fieldCls}
            >
              <option value="">Choisir…</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          {subcategories.length > 0 && (
            <div>
              <label className={labelCls}>Sous-catégorie</label>
              <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className={fieldCls}>
                <option value="">Toutes</option>
                {subcategories.map((s: string) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
      </Section>

      {/* ── Véhicule ─────────────────────────────────────────────────────────── */}
      {isVehicle && (
        <Section title="Caractéristiques du véhicule" icon="directions_car">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Marque</label>
              <input type="text" value={vehicle.marque} onChange={(e) => setV("marque", e.target.value)} placeholder="Ex : Audi" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Modèle</label>
              <input type="text" value={vehicle.modele} onChange={(e) => setV("modele", e.target.value)} placeholder="Ex : A3" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Année</label>
              <input type="number" value={vehicle.annee} onChange={(e) => setV("annee", e.target.value)} placeholder="2020" min="1900" max="2099" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Kilométrage</label>
              <input type="number" value={vehicle.kilometrage} onChange={(e) => setV("kilometrage", e.target.value)} placeholder="50000" min="0" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Carburant</label>
              <select value={vehicle.carburant} onChange={(e) => setV("carburant", e.target.value)} className={fieldCls}>
                {FUELS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Transmission</label>
              <select value={vehicle.transmission} onChange={(e) => setV("transmission", e.target.value)} className={fieldCls}>
                {TRANSMISSIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Couleur</label>
              <input type="text" value={vehicle.couleur} onChange={(e) => setV("couleur", e.target.value)} placeholder="Ex : Noir" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Nombre de portes</label>
              <select value={vehicle.nombrePortes} onChange={(e) => setV("nombrePortes", e.target.value)} className={fieldCls}>
                {["2", "3", "4", "5"].map((n) => <option key={n} value={n}>{n} portes</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Puissance fiscale (CV)</label>
              <input type="number" value={vehicle.puissanceFiscale} onChange={(e) => setV("puissanceFiscale", e.target.value)} placeholder="7" min="1" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Immatriculation</label>
              <input type="text" value={vehicle.immatriculation} onChange={(e) => setV("immatriculation", e.target.value)} placeholder="AB-123-CD" className={fieldCls} />
            </div>
          </div>
        </Section>
      )}

      {/* ── Immobilier ───────────────────────────────────────────────────────── */}
      {isImmo && (
        <Section title="Caractéristiques du bien" icon="home">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Type de bien</label>
              <select value={immo.typeBien} onChange={(e) => setI("typeBien", e.target.value)} className={fieldCls}>
                {IMMO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Surface (m²)</label>
              <input type="number" value={immo.surface} onChange={(e) => setI("surface", e.target.value)} placeholder="65" min="0" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Nombre de pièces</label>
              <input type="number" value={immo.nombrePieces} onChange={(e) => setI("nombrePieces", e.target.value)} placeholder="3" min="1" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Chambres</label>
              <input type="number" value={immo.nombreChambres} onChange={(e) => setI("nombreChambres", e.target.value)} placeholder="2" min="0" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Salles d&apos;eau</label>
              <input type="number" value={immo.nombreSallesEau} onChange={(e) => setI("nombreSallesEau", e.target.value)} placeholder="1" min="0" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Étage</label>
              <input type="text" value={immo.etage} onChange={(e) => setI("etage", e.target.value)} placeholder="2ème / RDC" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Exposition</label>
              <input type="text" value={immo.exposition} onChange={(e) => setI("exposition", e.target.value)} placeholder="Sud, Est…" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Places de parking</label>
              <input type="number" value={immo.placesParking} onChange={(e) => setI("placesParking", e.target.value)} placeholder="0" min="0" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Année de construction</label>
              <input type="number" value={immo.anneeConstruction} onChange={(e) => setI("anneeConstruction", e.target.value)} placeholder="1990" min="1800" max="2099" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Type de chauffage</label>
              <select value={immo.typeCharuffe} onChange={(e) => setI("typeCharuffe", e.target.value)} className={fieldCls}>
                <option value="">—</option>
                {CHAUFFAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Mode de chauffage</label>
              <select value={immo.modeCharuffe} onChange={(e) => setI("modeCharuffe", e.target.value)} className={fieldCls}>
                <option value="">—</option>
                {CHAUFFAGE_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Classe DPE</label>
              <select value={immo.classeEnergie} onChange={(e) => setI("classeEnergie", e.target.value)} className={fieldCls}>
                <option value="">—</option>
                {DPE_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>GES</label>
              <select value={immo.ges} onChange={(e) => setI("ges", e.target.value)} className={fieldCls}>
                <option value="">—</option>
                {DPE_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Référence</label>
              <input type="text" value={immo.reference} onChange={(e) => setI("reference", e.target.value)} placeholder="Réf. interne" className={fieldCls} />
            </div>
          </div>

          {/* Honoraires & taxes */}
          <div>
            <label className={labelCls}>Honoraires & taxes</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[#9ca3af] font-semibold block mb-1">Prix honoraires TTC inclus (€)</label>
                <input type="number" min="0" value={immo.prixHonorairesInclus} onChange={(e) => setI("prixHonorairesInclus", e.target.value)} placeholder="ex : 220 000" className={fieldCls} />
              </div>
              <div>
                <label className="text-[10px] text-[#9ca3af] font-semibold block mb-1">Prix honoraires TTC exclus (€)</label>
                <input type="number" min="0" value={immo.prixHonorairesExclus} onChange={(e) => setI("prixHonorairesExclus", e.target.value)} placeholder="ex : 210 000" className={fieldCls} />
              </div>
              <div>
                <label className="text-[10px] text-[#9ca3af] font-semibold block mb-1">Honoraires TTC acquéreur (€)</label>
                <input type="number" min="0" value={immo.honorairesAcquereur} onChange={(e) => setI("honorairesAcquereur", e.target.value)} placeholder="ex : 10 000" className={fieldCls} />
              </div>
              <div>
                <label className="text-[10px] text-[#9ca3af] font-semibold block mb-1">Taxe foncière annuelle (€)</label>
                <input type="number" min="0" value={immo.taxeFonciere} onChange={(e) => setI("taxeFonciere", e.target.value)} placeholder="ex : 1 200" className={fieldCls} />
              </div>
            </div>
          </div>

          {/* Booleans */}
          <div className="flex gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={immo.vueMer}
                onChange={(e) => setI("vueMer", e.target.checked)}
                className="w-4 h-4 rounded accent-[#2f6fb8]"
              />
              <span className="text-sm font-medium text-[#191c1e]">Vue sur mer</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!immo.visAVis}
                onChange={(e) => setI("visAVis", !e.target.checked)}
                className="w-4 h-4 rounded accent-[#2f6fb8]"
              />
              <span className="text-sm font-medium text-[#191c1e]">Pas de vis-à-vis</span>
            </label>
          </div>

          {/* Caractéristiques */}
          <div>
            <label className={labelCls}>Équipements</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {IMMO_FEATURES.map((feat) => {
                const active = immo.caracteristiques.includes(feat);
                return (
                  <button
                    key={feat}
                    type="button"
                    onClick={() => toggleCarac(feat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      active
                        ? "bg-[#2f6fb8] text-white border-[#2f6fb8]"
                        : "bg-white text-[#464652] border-[#eceef0] hover:border-[#2f6fb8]/40"
                    }`}
                  >
                    {feat}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {/* ── Localisation + Contact ────────────────────────────────────────────── */}
      <Section title="Localisation & contact" icon="location_on">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Ville / Code postal</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex : Paris 75001"
              required
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls}>Téléphone (optionnel)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 00 00 00 00"
              className={fieldCls}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hidePhone}
                onChange={(e) => setHidePhone(e.target.checked)}
                className="w-4 h-4 rounded accent-[#2f6fb8]"
              />
              <span className="text-sm text-[#464652] font-medium">Masquer le numéro</span>
            </label>
          </div>
        </div>
      </Section>

      {/* ── Description ──────────────────────────────────────────────────────── */}
      <Section title="Description" icon="description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={7}
          placeholder="Décrivez l'article en détail : état, historique, accessoires inclus, raison de la vente…"
          required
          className={fieldCls + " resize-none"}
        />
        <p className="text-xs text-[#9ca3af] text-right">{description.length} caractères</p>
      </Section>

      {/* ── Error + Submit ────────────────────────────────────────────────────── */}
      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl border border-red-100">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || uploading}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#2f6fb8] text-white rounded-xl font-bold text-sm hover:bg-[#1a5a9e] transition-all disabled:opacity-60 shadow-md shadow-[#2f6fb8]/20 active:scale-[0.99]"
      >
        <span className="material-symbols-outlined text-[18px]">publish</span>
        {loading ? "Publication en cours…" : "Publier l'annonce"}
      </button>
    </form>
  );
}

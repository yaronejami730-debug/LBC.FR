"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { CATEGORIES } from "@/lib/categories";
import { detectCategory } from "@/lib/autoCategory";

const CONDITIONS = ["Neuf", "Très bon état", "Bon état", "État correct", "Pour pièces"];
const FUELS = ["Essence", "Diesel", "Hybride", "Électrique", "GPL", "Autre"];
const TRANSMISSIONS = ["Manuelle", "Automatique"];

const MAX_PHOTOS = 15;

type PhotoGuide = { label: string; icon: string };

const PHOTO_GUIDES: Record<string, PhotoGuide[]> = {
  vehicules: [
    { label: "Face avant",         icon: "directions_car" },
    { label: "Face arrière",        icon: "directions_car" },
    { label: "Côté gauche",         icon: "directions_car" },
    { label: "Côté droit",          icon: "directions_car" },
    { label: "Tableau de bord",     icon: "dashboard" },
    { label: "Sièges avant",        icon: "airline_seat_recline_normal" },
    { label: "Sièges arrière",      icon: "airline_seat_recline_normal" },
    { label: "Volant",              icon: "settings_input_svideo" },
    { label: "Levier de vitesse",   icon: "tune" },
    { label: "Moteur",              icon: "build" },
    { label: "Coffre",              icon: "inventory_2" },
    { label: "Jantes / Roues",      icon: "tire_repair" },
    { label: "Compteur km",         icon: "speed" },
    { label: "Carnet entretien",    icon: "description" },
  ],
  multimedia: [
    { label: "Face avant",          icon: "computer" },
    { label: "Face arrière",        icon: "computer" },
    { label: "Profil gauche",       icon: "computer" },
    { label: "Profil droit",        icon: "computer" },
    { label: "Écran allumé",        icon: "monitor" },
    { label: "Clavier / Pavé",      icon: "keyboard" },
    { label: "Ports & connecteurs", icon: "usb" },
    { label: "Chargeur inclus",     icon: "power" },
    { label: "Accessoires",         icon: "devices_other" },
    { label: "Numéro de série",     icon: "qr_code" },
    { label: "Emballage d'origine", icon: "inventory_2" },
    { label: "Défauts / rayures",   icon: "warning" },
    { label: "Vue d'ensemble",      icon: "photo_camera" },
    { label: "Photo libre",         icon: "add_a_photo" },
  ],
  mode: [
    { label: "Vue de face",         icon: "checkroom" },
    { label: "Vue de dos",          icon: "checkroom" },
    { label: "Profil",              icon: "checkroom" },
    { label: "Étiquette / marque",  icon: "label" },
    { label: "Détail tissu",        icon: "texture" },
    { label: "Semelle (chaussures)",icon: "footprint" },
    { label: "Défauts / taches",    icon: "warning" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
  ],
  maison: [
    { label: "Vue d'ensemble",      icon: "chair" },
    { label: "Détail / finition",   icon: "zoom_in" },
    { label: "Marque / étiquette",  icon: "label" },
    { label: "Dimensions visibles", icon: "straighten" },
    { label: "Côté gauche",         icon: "chair" },
    { label: "Côté droit",          icon: "chair" },
    { label: "État général",        icon: "verified" },
    { label: "Défauts éventuels",   icon: "warning" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
  ],
  immobilier: [
    { label: "Façade extérieure",   icon: "home" },
    { label: "Salon / séjour",      icon: "chair" },
    { label: "Cuisine",             icon: "kitchen" },
    { label: "Chambre principale",  icon: "bed" },
    { label: "Salle de bain",       icon: "bathtub" },
    { label: "WC",                  icon: "wc" },
    { label: "Chambre 2",           icon: "bed" },
    { label: "Balcon / terrasse",   icon: "deck" },
    { label: "Cave / garage",       icon: "garage" },
    { label: "Entrée / couloir",    icon: "door_front" },
    { label: "Vue depuis fenêtre",  icon: "landscape" },
    { label: "Boîte aux lettres",   icon: "markunread_mailbox" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
  ],
  animaux: [
    { label: "Portrait de face",    icon: "pets" },
    { label: "Profil",              icon: "pets" },
    { label: "Corps entier",        icon: "pets" },
    { label: "En action / jeu",     icon: "sports" },
    { label: "Avec ses accessoires",icon: "toys" },
    { label: "Carnet de santé",     icon: "description" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
  ],
  loisirs: [
    { label: "Vue d'ensemble",      icon: "sports_esports" },
    { label: "Côté gauche",         icon: "photo_camera" },
    { label: "Côté droit",          icon: "photo_camera" },
    { label: "Accessoires inclus",  icon: "devices_other" },
    { label: "Numéro de série",     icon: "qr_code" },
    { label: "État général",        icon: "verified" },
    { label: "Défauts éventuels",   icon: "warning" },
    { label: "Emballage d'origine", icon: "inventory_2" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
    { label: "Photo libre",         icon: "add_a_photo" },
  ],
};

const DEFAULT_GUIDES: PhotoGuide[] = Array.from({ length: 14 }, (_, i) => ({
  label: i === 0 ? "Vue d'ensemble" : i === 1 ? "Détail" : i === 2 ? "État général" : "Photo libre",
  icon: i < 3 ? "photo_camera" : "add_a_photo",
}));

function getGuides(catId: string): PhotoGuide[] {
  return PHOTO_GUIDES[catId] ?? DEFAULT_GUIDES;
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
  const [categoryId, setCategoryId] = useState("maison");
  const [subcategory, setSubcategory] = useState("Ameublement");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [condition, setCondition] = useState("Bon état");
  const [phone, setPhone] = useState("");
  const [hidePhone, setHidePhone] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [photoStep, setPhotoStep] = useState(0); // current guided step (0 = main)
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [autoDetected, setAutoDetected] = useState(false); // true when category was auto-set
  const [userPickedCategory, setUserPickedCategory] = useState(false); // true when user manually picked
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
    if (images.length >= MAX_PHOTOS && slotIndex === undefined) return;

    setUploading(true);
    setPublishError(null);
    try {
      const uploads: string[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Erreur lors de l'envoi de l'image");
        }
        const data = await res.json();
        if (!data.url) throw new Error("Réponse invalide du serveur d'upload");
        uploads.push(data.url);
      }

      if (slotIndex !== undefined) {
        setImages((prev) => {
          const next = [...prev];
          for (let i = 0; i < slotIndex; i++) {
            if (next[i] === undefined) next[i] = "";
          }
          next[slotIndex] = uploads[0];
          return next.filter(Boolean);
        });
      } else {
        setImages((prev) => [...prev, ...uploads].slice(0, MAX_PHOTOS));
      }
    } catch (err) {
      console.error("[handleImageUpload]", err);
      setPublishError(err instanceof Error ? err.message : "Une erreur est survenue lors de l'envoi.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handlePublish() {
    if (!title || !price || !description || !location) return;
    const activeCategory = CATEGORIES.find(c => c.id === categoryId);
    const categoryLabel = activeCategory?.label || "Divers";
    
    setPublishing(true);
    setPublishError(null);
    const metadata = categoryId === "vehicules" ? JSON.stringify(vehicle) : "{}";
    try {
      // Clean images before sending (remove empty strings if any)
      const cleanImages = images.filter(Boolean);
      
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          price: parseFloat(price),
          category: categoryLabel,
          subcategory,
          description,
          location,
          condition,
          images: cleanImages,
          metadata,
          phone: phone.trim() || null,
          hidePhone,
        }),
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

  return (
    <div className="bg-surface-container-low text-on-surface antialiased pb-32">
      {/* TopAppBar */}
      <header className="bg-white/80 backdrop-blur-xl fixed top-0 w-full z-50 shadow-[0_16px_32px_rgba(21,21,125,0.06)]">
        <div className="flex items-center justify-between px-6 py-4 w-full max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-primary active:scale-95 transition-transform p-2 hover:bg-slate-50 rounded-full">
              <span className="material-symbols-outlined">close</span>
            </Link>
            <img src="/logo.png" alt="Le Bon Deal" className="h-12 w-auto" />
          </div>
          <span className="font-['Manrope'] font-bold text-base tracking-tight text-primary">Nouvelle annonce</span>
        </div>
        <div className="bg-slate-100/50 h-[1px]" />
      </header>

      <main className="max-w-3xl mx-auto pt-32 px-6">
        <div className="space-y-10">
          <section className="space-y-1">
            <p className="text-sm font-semibold text-primary uppercase tracking-[0.05em]">Pour commencer</p>
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">Déposez votre annonce</h2>
            <p className="text-on-surface-variant">Créez une annonce de qualité pour toucher des milliers d'acheteurs.</p>
          </section>

          {/* ── PHOTOS (stepper guidé) ────────────────────────────── */}
          {(() => {
            const guides = getGuides(categoryId);
            // step 0 = photo principale, steps 1..guides.length = guides
            const totalSteps = 1 + guides.length; // 15 max
            const isMainStep = photoStep === 0;
            const currentGuide = isMainStep
              ? { label: "Photo principale", icon: "add_a_photo" }
              : guides[photoStep - 1];
            const currentImg = images[photoStep];
            const doneCount = images.filter(Boolean).length;
            const isLastStep = photoStep === totalSteps - 1;

            function triggerUpload() {
              if (isMainStep) {
                mainFileRef.current?.click();
              } else {
                extraFileRef.current?.setAttribute("data-slot", String(photoStep));
                extraFileRef.current?.click();
              }
            }

            function goNext() {
              if (photoStep < totalSteps - 1) setPhotoStep((s) => s + 1);
            }
            function goPrev() {
              if (photoStep > 0) setPhotoStep((s) => s - 1);
            }

            return (
              <section className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-on-surface">Photos</h3>
                    <p className="text-xs text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      Jusqu&apos;à {MAX_PHOTOS} photos · 100% gratuit
                    </p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-primary">
                    {doneCount} / {MAX_PHOTOS}
                  </span>
                </div>

                {/* Progress bar + step label */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-outline font-medium">
                    <span>Étape {photoStep + 1} sur {totalSteps}</span>
                    {doneCount > 0 && (
                      <span className="text-emerald-600 font-semibold">{doneCount} photo{doneCount > 1 ? "s" : ""} ajoutée{doneCount > 1 ? "s" : ""}</span>
                    )}
                  </div>
                  {/* Steps dots */}
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPhotoStep(i)}
                        className={`h-1.5 rounded-full shrink-0 transition-all duration-200 ${
                          i === photoStep
                            ? "w-6 bg-primary"
                            : images[i]
                            ? "w-3 bg-emerald-500"
                            : "w-3 bg-outline-variant/40"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Active step — zone principale */}
                <div
                  className={`relative overflow-hidden rounded-2xl transition-all ${
                    currentImg
                      ? "h-56 md:h-72 cursor-default"
                      : "h-56 md:h-72 cursor-pointer border-2 border-dashed hover:border-primary bg-surface-container-highest group"
                  } ${!currentImg ? (isMainStep ? "border-primary/50" : "border-outline-variant") : ""}`}
                  onClick={() => { if (!currentImg) triggerUpload(); }}
                >
                  {currentImg ? (
                    <>
                      {/* Blurred bg */}
                      <img src={currentImg} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40 pointer-events-none" />
                      {/* Full photo */}
                      <img src={currentImg} alt={currentGuide.label} className="relative w-full h-full object-contain z-10" />
                      {/* Actions overlay */}
                      <div className="absolute inset-0 z-20 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center gap-3 opacity-0 hover:opacity-100">
                        <button type="button" onClick={triggerUpload}
                          className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/40 transition-colors">
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button type="button" onClick={() => { removeImage(photoStep); }}
                          className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-red-500/60 transition-colors">
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                      {/* Label badge */}
                      <span className="absolute top-3 left-3 z-20 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                        {currentGuide.label}
                      </span>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                      {uploading ? (
                        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-primary border-t-transparent" />
                      ) : (
                        <>
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isMainStep ? "bg-primary/10" : "bg-surface-container"}`}>
                            <span className={`material-symbols-outlined text-4xl ${isMainStep ? "text-primary" : "text-outline"}`}>
                              {currentGuide.icon}
                            </span>
                          </div>
                          <div className="text-center px-6">
                            <p className={`font-bold text-base ${isMainStep ? "text-primary" : "text-on-surface"}`}>
                              {currentGuide.label}
                            </p>
                            {isMainStep && (
                              <p className="text-outline text-xs mt-1">C&apos;est la photo qui apparaît en premier dans l&apos;annonce</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 bg-primary/8 text-primary text-xs font-semibold px-4 py-2 rounded-full border border-primary/20">
                            <span className="material-symbols-outlined text-base">add_a_photo</span>
                            Appuyer pour ajouter cette photo
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-3">
                  {photoStep > 0 && (
                    <button type="button" onClick={goPrev}
                      className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors shrink-0">
                      <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                  )}

                  {currentImg ? (
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={isLastStep}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-primary text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-40"
                    >
                      {isLastStep ? "Photos complètes ✓" : (
                        <>Suivant <span className="material-symbols-outlined text-base">arrow_forward</span></>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={!isMainStep ? goNext : undefined}
                      disabled={isMainStep}
                      className={`flex-1 py-3 rounded-full text-sm font-semibold transition-all ${
                        isMainStep
                          ? "bg-surface-container text-outline cursor-default opacity-50"
                          : "bg-surface-container text-outline hover:text-on-surface active:scale-95"
                      }`}
                    >
                      {isMainStep ? "Ajoutez d'abord la photo principale" : "Passer cette étape →"}
                    </button>
                  )}
                </div>

                {/* Strip des photos déjà uploadées */}
                {doneCount > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-outline font-semibold uppercase tracking-wider">Photos ajoutées</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {images.map((img, i) =>
                        img ? (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setPhotoStep(i)}
                            className={`relative w-16 h-16 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                              i === photoStep ? "border-primary scale-105" : "border-transparent hover:border-outline-variant"
                            }`}
                          >
                            <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover blur-sm scale-110 opacity-60" />
                            <img src={img} alt="" className="relative w-full h-full object-contain" />
                            {/* Step number badge */}
                            <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[9px] font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            {/* Delete */}
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:!opacity-100 transition-opacity">
                              <span className="material-symbols-outlined text-[10px]">close</span>
                            </button>
                          </button>
                        ) : null
                      )}
                    </div>
                  </div>
                )}

                <input ref={mainFileRef} type="file" accept="image/*" className="hidden"
                  onChange={async (e) => {
                    await handleImageUpload(e.target.files, 0);
                    // auto-advance after upload
                    setPhotoStep((s) => s === 0 ? 1 : s);
                    e.target.value = "";
                  }} />
                <input ref={extraFileRef} type="file" accept="image/*" className="hidden"
                  onChange={async (e) => {
                    const slot = parseInt(extraFileRef.current?.getAttribute("data-slot") ?? "");
                    const targetSlot = isNaN(slot) ? photoStep : slot;
                    await handleImageUpload(e.target.files, targetSlot);
                    extraFileRef.current?.removeAttribute("data-slot");
                    // auto-advance
                    setPhotoStep((s) => Math.min(s + 1, totalSteps - 1));
                    e.target.value = "";
                  }} />
              </section>
            );
          })()}

          {/* ── CHAMPS PRINCIPAUX ─────────────────────────────────── */}
          <section className="space-y-8 bg-surface-container-lowest p-6 rounded-2xl shadow-sm">
            {/* Titre */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-primary tracking-widest uppercase">Titre</label>
              <input
                value={title}
                onChange={(e) => {
                  const newTitle = e.target.value;
                  setTitle(newTitle);
                  if (!userPickedCategory) {
                    const match = detectCategory(newTitle);
                    if (match) {
                      setCategoryId(match.categoryId);
                      setSubcategory(match.subcategory);
                      setAutoDetected(true);
                    } else {
                      setAutoDetected(false);
                    }
                  }
                }}
                className="w-full bg-transparent border-none p-0 text-2xl font-['Manrope'] font-semibold text-on-surface placeholder:text-outline-variant focus:ring-0 outline-none text-base"
                placeholder="Que vendez-vous ?" type="text" />
              <div className="h-[2px] bg-surface-container" />
              {autoDetected && (
                <p className="text-[11px] text-primary flex items-center gap-1 pt-1">
                  <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                  Catégorie détectée automatiquement
                </p>
              )}
            </div>

            {/* Prix */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-primary tracking-widest uppercase">Prix</label>
              <div className="flex items-baseline gap-2">
                <input value={price} onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-transparent border-none p-0 text-4xl font-['Manrope'] font-extrabold text-on-surface placeholder:text-outline-variant focus:ring-0 outline-none text-base"
                  placeholder="0" type="number" min="0" step="1" />
                <span className="text-3xl font-['Manrope'] font-bold text-on-surface-variant">€</span>
              </div>
              <div className="h-[2px] bg-surface-container" />
            </div>

            {/* Catégorie */}
            <div className="space-y-4">
              <label className="block text-xs font-bold text-primary tracking-widest uppercase">Catégorie</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {CATEGORIES.map((cat) => (
                  <button 
                    key={cat.id} 
                    type="button" 
                    onClick={() => {
                      setCategoryId(cat.id);
                      setSubcategory(cat.subcategories[0]);
                      setUserPickedCategory(true);
                      setAutoDetected(false);
                    }}
                    className={`px-3 py-3 rounded-2xl flex flex-col items-center gap-2 transition-all border ${categoryId === cat.id ? "bg-primary/5 border-primary text-primary" : "bg-white border-slate-100 text-slate-500 hover:border-slate-300"}`}
                  >
                    <span className="material-symbols-outlined text-2xl">{cat.icon}</span>
                    <span className="text-[10px] font-bold uppercase tracking-tight text-center">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sous-catégorie */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-primary tracking-widest uppercase">Sous-catégorie</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.find(c => c.id === categoryId)?.subcategories.map((sub) => (
                  <button 
                    key={sub} 
                    type="button" 
                    onClick={() => setSubcategory(sub)}
                    className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${subcategory === sub ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary"}`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* ── CHAMPS VÉHICULES ─────────────────────────────── */}
            {categoryId === "vehicules" && (
              <div className="space-y-6 border-t border-surface-container pt-6">
                <p className="text-xs font-bold text-primary tracking-widest uppercase">Caractéristiques du véhicule</p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-outline uppercase tracking-wider">Marque</label>
                    <input value={vehicle.marque} onChange={(e) => setV("marque", e.target.value)}
                      className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-base text-on-surface outline-none focus:ring-2 focus:ring-primary border-none"
                      placeholder="Ex : Renault, BMW…" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-outline uppercase tracking-wider">Modèle</label>
                    <input value={vehicle.modele} onChange={(e) => setV("modele", e.target.value)}
                      className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-base text-on-surface outline-none focus:ring-2 focus:ring-primary border-none"
                      placeholder="Ex : Clio, Série 3…" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-outline uppercase tracking-wider">Année</label>
                    <input value={vehicle.annee} onChange={(e) => setV("annee", e.target.value)}
                      className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-base text-on-surface outline-none focus:ring-2 focus:ring-primary border-none"
                      placeholder="Ex : 2021" type="number" min="1900" max="2026" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-outline uppercase tracking-wider">Kilométrage</label>
                    <div className="relative">
                      <input value={vehicle.kilometrage} onChange={(e) => setV("kilometrage", e.target.value)}
                        className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-base text-on-surface outline-none focus:ring-2 focus:ring-primary border-none pr-10"
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
                      className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-base text-on-surface outline-none focus:ring-2 focus:ring-primary border-none"
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
                        className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-base text-on-surface outline-none focus:ring-2 focus:ring-primary border-none pr-8"
                        placeholder="Ex : 7" type="number" min="1" />
                      <span className="absolute right-3 top-2.5 text-xs text-outline font-medium">CV</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-outline uppercase tracking-wider">Immatriculation</label>
                    <input value={vehicle.immatriculation} onChange={(e) => setV("immatriculation", e.target.value.toUpperCase())}
                      className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-base font-mono text-on-surface outline-none focus:ring-2 focus:ring-primary border-none tracking-widest"
                      placeholder="AB-123-CD" maxLength={10} />
                  </div>
                </div>
              </div>
            )}

            {/* Localisation */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-primary tracking-widest uppercase">Localisation</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-transparent border-none p-0 text-xl font-['Manrope'] font-semibold text-on-surface placeholder:text-outline-variant focus:ring-0 outline-none text-base"
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
                className="w-full bg-transparent border-none p-0 text-base text-on-surface placeholder:text-outline-variant focus:ring-0 leading-relaxed resize-none outline-none"
                placeholder="Décrivez votre article : état, âge, raison de la vente…"
                rows={6} />
              <div className="h-[1px] bg-surface-container" />
            </div>

            {/* Téléphone */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-primary tracking-widest uppercase">
                Numéro de téléphone <span className="text-outline normal-case font-normal">(facultatif)</span>
              </label>
              <div className="flex items-center border-none gap-2">
                <div className="flex items-center bg-surface-container rounded-xl px-3 py-2.5 gap-2 flex-1">
                  <span className="material-symbols-outlined text-outline text-[18px]">call</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    type="tel"
                    placeholder="Ex : 06 12 34 56 78"
                    className="bg-transparent border-none focus:ring-0 text-sm outline-none flex-1 text-on-surface"
                    maxLength={20}
                  />
                </div>
              </div>
              {phone.trim() && (
                <label className="flex items-center gap-3 cursor-pointer select-none group">
                  <div
                    onClick={() => setHidePhone((v) => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${hidePhone ? "bg-[#2f6fb8]" : "bg-slate-200"}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${hidePhone ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-on-surface">Masquer mon numéro de téléphone</span>
                    <p className="text-xs text-outline mt-0.5">
                      {hidePhone
                        ? "Les acheteurs ne verront pas le numéro — messagerie uniquement"
                        : "Le numéro sera visible sur l'annonce"}
                    </p>
                  </div>
                </label>
              )}
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

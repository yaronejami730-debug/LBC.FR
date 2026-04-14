"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { detectCategory } from "@/lib/autoCategory";
// ── Constants ─────────────────────────────────────────────────────────────────

const CONDITIONS = ["Neuf", "Très bon état", "Bon état", "État correct", "Pour pièces"];
const FUELS      = ["Essence", "Diesel", "Hybride", "Électrique", "GPL", "Autre"];
const TRANSMISSIONS = ["Manuelle", "Automatique"];
const MAX_PHOTOS = 15;

// ── Types ─────────────────────────────────────────────────────────────────────

type PhotoMode = "choose" | "guided" | "free";
type FormStep  = 0 | 1 | 2 | 3 | 4; // 0=photos 1=titre 2=catégorie 3=desc 4=coordonnées

type VehicleFields = {
  marque: string; modele: string; annee: string; kilometrage: string;
  carburant: string; transmission: string; couleur: string;
  immatriculation: string; puissanceFiscale: string; nombrePortes: string;
};

type PhotoGuide = { label: string; icon: string };

// ── Photo guides by category ───────────────────────────────────────────────────

const PHOTO_GUIDES: Record<string, PhotoGuide[]> = {
  vehicules: [
    { label: "Face avant",          icon: "directions_car" },
    { label: "Face arrière",         icon: "directions_car" },
    { label: "Côté gauche",          icon: "directions_car" },
    { label: "Côté droit",           icon: "directions_car" },
    { label: "Tableau de bord",      icon: "dashboard" },
    { label: "Sièges avant",         icon: "airline_seat_recline_normal" },
    { label: "Sièges arrière",        icon: "airline_seat_recline_normal" },
    { label: "Volant",               icon: "settings_input_svideo" },
    { label: "Levier de vitesse",    icon: "tune" },
    { label: "Moteur",               icon: "build" },
    { label: "Coffre",               icon: "inventory_2" },
    { label: "Jantes / Roues",       icon: "tire_repair" },
    { label: "Compteur km",          icon: "speed" },
    { label: "Carnet entretien",     icon: "description" },
  ],
  multimedia: [
    { label: "Face avant",           icon: "computer" },
    { label: "Face arrière",          icon: "computer" },
    { label: "Profil gauche",        icon: "computer" },
    { label: "Profil droit",         icon: "computer" },
    { label: "Écran allumé",         icon: "monitor" },
    { label: "Clavier / Pavé",       icon: "keyboard" },
    { label: "Ports & connecteurs",  icon: "usb" },
    { label: "Chargeur inclus",      icon: "power" },
    { label: "Accessoires",          icon: "devices_other" },
    { label: "Numéro de série",      icon: "qr_code" },
    { label: "Emballage d'origine",  icon: "inventory_2" },
    { label: "Défauts / rayures",    icon: "warning" },
    { label: "Vue d'ensemble",       icon: "photo_camera" },
    { label: "Photo libre",          icon: "add_a_photo" },
  ],
  mode: [
    { label: "Vue de face",          icon: "checkroom" },
    { label: "Vue de dos",           icon: "checkroom" },
    { label: "Profil",               icon: "checkroom" },
    { label: "Étiquette / marque",   icon: "label" },
    { label: "Détail tissu",         icon: "texture" },
    { label: "Semelle (chaussures)", icon: "footprint" },
    { label: "Défauts / taches",     icon: "warning" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
  ],
  maison: [
    { label: "Vue d'ensemble",       icon: "chair" },
    { label: "Détail / finition",    icon: "zoom_in" },
    { label: "Marque / étiquette",   icon: "label" },
    { label: "Dimensions visibles",  icon: "straighten" },
    { label: "Côté gauche",          icon: "chair" },
    { label: "Côté droit",           icon: "chair" },
    { label: "État général",         icon: "verified" },
    { label: "Défauts éventuels",    icon: "warning" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
  ],
  immobilier: [
    { label: "Façade extérieure",    icon: "home" },
    { label: "Salon / séjour",       icon: "chair" },
    { label: "Cuisine",              icon: "kitchen" },
    { label: "Chambre principale",   icon: "bed" },
    { label: "Salle de bain",        icon: "bathtub" },
    { label: "WC",                   icon: "wc" },
    { label: "Chambre 2",            icon: "bed" },
    { label: "Balcon / terrasse",    icon: "deck" },
    { label: "Cave / garage",        icon: "garage" },
    { label: "Entrée / couloir",     icon: "door_front" },
    { label: "Vue depuis fenêtre",   icon: "landscape" },
    { label: "Boîte aux lettres",    icon: "markunread_mailbox" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
  ],
  animaux: [
    { label: "Portrait de face",     icon: "pets" },
    { label: "Profil",               icon: "pets" },
    { label: "Corps entier",         icon: "pets" },
    { label: "En action / jeu",      icon: "sports" },
    { label: "Avec ses accessoires", icon: "toys" },
    { label: "Carnet de santé",      icon: "description" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
  ],
  loisirs: [
    { label: "Vue d'ensemble",       icon: "sports_esports" },
    { label: "Côté gauche",          icon: "photo_camera" },
    { label: "Côté droit",           icon: "photo_camera" },
    { label: "Accessoires inclus",   icon: "devices_other" },
    { label: "Numéro de série",      icon: "qr_code" },
    { label: "État général",         icon: "verified" },
    { label: "Défauts éventuels",    icon: "warning" },
    { label: "Emballage d'origine",  icon: "inventory_2" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
    { label: "Photo libre",          icon: "add_a_photo" },
  ],
};

const DEFAULT_GUIDES: PhotoGuide[] = [
  { label: "Vue d'ensemble",        icon: "photo_camera" },
  { label: "Détail",                icon: "photo_camera" },
  { label: "État général",          icon: "photo_camera" },
  ...Array.from({ length: 11 }, () => ({ label: "Photo libre", icon: "add_a_photo" as string })),
];

function getGuides(catId: string): PhotoGuide[] {
  return PHOTO_GUIDES[catId] ?? DEFAULT_GUIDES;
}

// ── localStorage preference helpers ──────────────────────────────────────────

const PREF_KEY = "dc_photoModePref";
interface PhotoPref { guided: number; free: number; lastPost: number | null }

function loadPref(): PhotoPref {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(PREF_KEY) : null;
    return s ? JSON.parse(s) : { guided: 0, free: 0, lastPost: null };
  } catch { return { guided: 0, free: 0, lastPost: null }; }
}

function savePref(mode: "guided" | "free") {
  const p = loadPref();
  p[mode]++;
  p.lastPost = Date.now();
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

function getAutoMode(): PhotoMode {
  const p = loadPref();
  const days = p.lastPost ? (Date.now() - p.lastPost) / 86_400_000 : 999;
  if (days > 10) return "choose";
  if (p.guided >= 3 && p.guided > p.free * 1.5) return "guided";
  if (p.free  >= 3 && p.free  > p.guided * 1.5) return "free";
  return "choose";
}

// ── Reusable field styles ─────────────────────────────────────────────────────

const inputCls =
  "w-full bg-surface-container-low rounded-xl px-4 py-3 text-base text-on-surface outline-none focus:ring-2 focus:ring-primary/50 border border-transparent focus:border-primary/30 transition-all placeholder:text-outline-variant/60";

const pillCls = (active: boolean) =>
  `px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
    active
      ? "bg-primary text-white border-primary shadow-sm"
      : "bg-white border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary"
  }`;

// ── Step labels ───────────────────────────────────────────────────────────────

// 0=Titre  1=Photos  2=Prix(+catégorie)  3=Description  4=Coordonnées
const STEP_LABELS = ["Titre", "Photos", "Prix", "Description", "Coordonnées"];

// ── Tips per step ─────────────────────────────────────────────────────────────


// ── Component ─────────────────────────────────────────────────────────────────

export default function PostForm() {
  const router = useRouter();

  // Form state
  const [formStep,    setFormStep]    = useState<FormStep>(0);
  const [title,       setTitle]       = useState("");
  const [price,       setPrice]       = useState("");
  const [categoryId,  setCategoryId]  = useState("maison");
  const [subcategory, setSubcategory] = useState("Ameublement");
  const [description, setDescription] = useState("");
  const [location,    setLocation]    = useState("");
  const [condition,   setCondition]   = useState("Bon état");
  const [phone,       setPhone]       = useState("");
  const [hidePhone,   setHidePhone]   = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);
  const [userPickedCategory, setUserPickedCategory] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleFields>({
    marque: "", modele: "", annee: "", kilometrage: "",
    carburant: "Essence", transmission: "Manuelle",
    couleur: "", immatriculation: "", puissanceFiscale: "", nombrePortes: "5",
  });

  // Photo state
  const [images,     setImages]     = useState<string[]>([]);
  const [photoMode,  setPhotoMode]  = useState<PhotoMode>("choose");
  const [photoStep,  setPhotoStep]  = useState(0);
  const [uploading,  setUploading]  = useState(false);


  // Publish state
  const [publishing,    setPublishing]    = useState(false);
  const [publishError,  setPublishError]  = useState<string | null>(null);

  const mainFileRef  = useRef<HTMLInputElement>(null);
  const extraFileRef = useRef<HTMLInputElement>(null);

  // Init photo mode from preference
  useEffect(() => {
    setPhotoMode(getAutoMode());
  }, []);

  function setV(field: keyof VehicleFields, value: string) {
    setVehicle((v) => ({ ...v, [field]: value }));
  }

  function pickMode(mode: "guided" | "free") {
    savePref(mode);
    setPhotoMode(mode);
  }

  // ── Upload ───────────────────────────────────────────────────────────────────

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
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Erreur d'envoi");
        }
        const data = await res.json();
        if (!data.url) throw new Error("Réponse invalide");
        uploads.push(data.url);
      }
      if (slotIndex !== undefined) {
        // Remplir depuis slotIndex pour les sélections multiples
        setImages((prev) => {
          const next = [...prev];
          for (let i = 0; i < slotIndex; i++) if (next[i] === undefined) next[i] = "";
          uploads.forEach((url, offset) => {
            if (slotIndex + offset < MAX_PHOTOS) next[slotIndex + offset] = url;
          });
          return next.filter(Boolean).slice(0, MAX_PHOTOS);
        });
      } else {
        setImages((prev) => [...prev, ...uploads].slice(0, MAX_PHOTOS));
      }
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Erreur lors de l'envoi.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Publish ──────────────────────────────────────────────────────────────────

  async function handlePublish() {
    if (!title || !price || !description || !location) return;
    const cat = CATEGORIES.find((c) => c.id === categoryId);
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, price: parseFloat(price),
          category: cat?.label || "Divers", subcategory,
          description, location, condition,
          images: images.filter(Boolean),
          metadata: categoryId === "vehicules" ? JSON.stringify(vehicle) : "{}",
          phone: phone.trim() || null, hidePhone,
        }),
      });
      if (res.status === 401) { router.push("/login?callbackUrl=/post"); return; }
      const text = await res.text();
      let data: { id?: string; error?: string } = {};
      try { data = JSON.parse(text); } catch { /* html error page */ }
      if (!res.ok) { setPublishError(data.error || `Erreur ${res.status}`); return; }
      if (!data.id) { setPublishError("Réponse inattendue. Réessayez."); return; }
      router.push(`/annonce/${data.id}`);
    } catch {
      setPublishError("Impossible de joindre le serveur.");
    } finally {
      setPublishing(false);
    }
  }

  // ── Step validation ───────────────────────────────────────────────────────────

  function canAdvance(step: FormStep): boolean {
    if (step === 0) return title.trim().length > 0; // titre obligatoire
    if (step === 1) return true;                    // photos optionnelles
    if (step === 2) return price.trim().length > 0; // prix obligatoire
    if (step === 3) return description.trim().length > 0;
    return true;
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const guides    = getGuides(categoryId);
  const totalPhotoSteps = 1 + guides.length;
  const doneCount = images.filter(Boolean).length;

  return (
    <div className="bg-[#f7f8fc] text-on-surface min-h-screen pb-32">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white fixed top-0 w-full z-50 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between px-5 py-3 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500">
              <span className="material-symbols-outlined text-xl">close</span>
            </Link>
            <img src="/logo.png" alt="Deal&Co" className="h-9 w-auto" />
          </div>
          <span className="text-xs font-bold text-primary uppercase tracking-widest">Nouvelle annonce</span>
        </div>

        {/* Step progress bar */}
        <div className="max-w-2xl mx-auto px-5 pb-3">
          <div className="flex items-center gap-1.5">
            {STEP_LABELS.map((label, i) => (
              <div key={i} className="flex items-center gap-1.5 flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={`h-1 rounded-full w-full transition-all duration-300 ${
                      i < formStep ? "bg-emerald-500" : i === formStep ? "bg-primary" : "bg-slate-200"
                    }`}
                  />
                  <span className={`text-[9px] font-bold uppercase tracking-wide truncate transition-colors ${
                    i === formStep ? "text-primary" : i < formStep ? "text-emerald-500" : "text-slate-300"
                  }`}>
                    {label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto pt-32 px-4 space-y-6">

        {/* ══ STEP 1 : PHOTOS ═══════════════════════════════════════════════ */}
        {formStep === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold text-on-surface">Photos</h2>
              <p className="text-sm text-outline mt-0.5">Jusqu&apos;à {MAX_PHOTOS} · Toutes gratuites</p>
            </div>

            {/* Plate warning — vehicles only */}
            {categoryId === "vehicules" && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <span className="material-symbols-outlined text-amber-500 text-xl shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                <p className="text-sm text-amber-800 font-medium leading-snug">
                  Attention — veuillez flouter vos plaques d&apos;immatriculation si celles-ci sont apparentes sur vos photos.
                </p>
              </div>
            )}

            {/* ── Mode "choose" ── */}
            {photoMode === "choose" && (
              <div className="space-y-3">
                <p className="text-sm text-on-surface-variant font-medium">Comment souhaitez-vous ajouter vos photos ?</p>
                <div className="grid grid-cols-1 gap-3">
                  <button type="button" onClick={() => pickMode("guided")}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white border-2 border-primary/20 hover:border-primary shadow-sm active:scale-[0.99] transition-all text-left">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-primary text-2xl">auto_awesome</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-on-surface">Aide à la photo</p>
                      <p className="text-outline text-xs mt-0.5">On vous guide angle par angle pour une annonce qui vend mieux</p>
                    </div>
                    <span className="material-symbols-outlined text-primary text-xl shrink-0">chevron_right</span>
                  </button>
                  <button type="button" onClick={() => pickMode("free")}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-sm active:scale-[0.99] transition-all text-left">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-slate-500 text-2xl">photo_library</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-on-surface">Ajouter mes photos</p>
                      <p className="text-outline text-xs mt-0.5">Je gère mes photos moi-même, librement</p>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-xl shrink-0">chevron_right</span>
                  </button>
                </div>
              </div>
            )}

            {/* ── Mode "free" : slots progressifs ── */}
            {photoMode === "free" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-on-surface">{doneCount} / {MAX_PHOTOS} photos</p>
                  <button type="button" onClick={() => setPhotoMode("choose")}
                    className="text-xs text-outline underline underline-offset-2">Changer</button>
                </div>

                {/* Progressive slots — never all at once */}
                <div className="flex flex-col gap-3">
                  {Array.from({ length: Math.min(doneCount + 1, MAX_PHOTOS) }).map((_, i) => {
                    const img = images[i];
                    const isMain = i === 0;
                    return (
                      <div key={i}
                        className={`relative overflow-hidden rounded-2xl cursor-pointer group transition-all ${
                          img ? "h-48" : isMain ? "h-48 border-2 border-dashed border-primary/40 bg-white" : "h-20 border-2 border-dashed border-slate-200 bg-white hover:border-primary/40"
                        }`}
                        onClick={() => {
                          extraFileRef.current?.setAttribute("data-slot", String(i));
                          extraFileRef.current?.click();
                        }}
                      >
                        {img ? (
                          <>
                            <img src={img} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-40" />
                            <img src={img} alt={`Photo ${i + 1}`} className="relative w-full h-full object-contain" />
                            <span className="absolute top-3 left-3 bg-black/50 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
                              {isMain ? "Principale" : `Photo ${i + 1}`}
                            </span>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                              <button type="button" onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                                className="w-10 h-10 rounded-full bg-red-500/80 text-white flex items-center justify-center">
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center gap-3">
                            {uploading ? (
                              <div className="animate-spin rounded-full h-6 w-6 border-[3px] border-primary border-t-transparent" />
                            ) : (
                              <>
                                <span className={`material-symbols-outlined ${isMain ? "text-primary text-4xl" : "text-slate-400 text-2xl"}`}>
                                  {isMain ? "add_a_photo" : "add"}
                                </span>
                                {isMain && <p className="font-bold text-primary text-sm">Ajouter la photo principale</p>}
                                {!isMain && <p className="text-sm text-slate-400 font-medium">Ajouter une ou plusieurs photos</p>}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <input ref={mainFileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { handleImageUpload(e.target.files, 0); e.target.value = ""; }} />
                <input ref={extraFileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => {
                    const slot = parseInt(extraFileRef.current?.getAttribute("data-slot") ?? "");
                    handleImageUpload(e.target.files, isNaN(slot) ? undefined : slot);
                    extraFileRef.current?.removeAttribute("data-slot");
                    e.target.value = "";
                  }} />
              </div>
            )}

            {/* ── Mode "guided" : stepper ── */}
            {photoMode === "guided" && (
              <div className="space-y-4">
                {/* Header guided */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      Étape <span className="text-primary">{photoStep + 1}</span> / {totalPhotoSteps}
                    </p>
                    {doneCount > 0 && (
                      <p className="text-xs text-emerald-600 font-semibold">{doneCount} photo{doneCount > 1 ? "s" : ""} ajoutée{doneCount > 1 ? "s" : ""}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => setPhotoMode("choose")}
                    className="text-xs text-outline underline underline-offset-2">Changer</button>
                </div>

                {/* Progress dots */}
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {Array.from({ length: totalPhotoSteps }).map((_, i) => (
                    <button key={i} type="button" onClick={() => setPhotoStep(i)}
                      className={`h-1.5 rounded-full shrink-0 transition-all duration-200 ${
                        i === photoStep ? "w-6 bg-primary" : images[i] ? "w-3 bg-emerald-500" : "w-3 bg-slate-200"
                      }`}
                    />
                  ))}
                </div>

                {/* Active slot */}
                {(() => {
                  const isMain = photoStep === 0;
                  const guide  = isMain ? { label: "Photo principale", icon: "add_a_photo" } : guides[photoStep - 1];
                  const img    = images[photoStep];
                  const isLast = photoStep === totalPhotoSteps - 1;

                  function triggerUpload() {
                    if (isMain) { mainFileRef.current?.click(); }
                    else {
                      extraFileRef.current?.setAttribute("data-slot", String(photoStep));
                      extraFileRef.current?.click();
                    }
                  }

                  return (
                    <div className="space-y-3">
                      {/* Big photo area */}
                      <div
                        className={`relative overflow-hidden rounded-2xl h-56 md:h-72 transition-all ${
                          img ? "cursor-default" : "cursor-pointer bg-white border-2 border-dashed hover:border-primary " + (isMain ? "border-primary/40" : "border-slate-200")
                        }`}
                        onClick={() => { if (!img) triggerUpload(); }}
                      >
                        {img ? (
                          <>
                            <img src={img} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-40" />
                            <img src={img} alt={guide.label} className="relative w-full h-full object-contain" />
                            <span className="absolute top-3 left-3 bg-black/50 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">{guide.label}</span>
                            <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center gap-3 opacity-0 hover:opacity-100">
                              <button type="button" onClick={triggerUpload}
                                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/40 transition-colors">
                                <span className="material-symbols-outlined">edit</span>
                              </button>
                              <button type="button" onClick={() => removeImage(photoStep)}
                                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-red-500/60 transition-colors">
                                <span className="material-symbols-outlined">delete</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                            {uploading ? (
                              <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-primary border-t-transparent" />
                            ) : (
                              <>
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isMain ? "bg-primary/10" : "bg-slate-100"}`}>
                                  <span className={`material-symbols-outlined text-4xl ${isMain ? "text-primary" : "text-slate-400"}`}>{guide.icon}</span>
                                </div>
                                <div className="text-center px-8">
                                  <p className={`font-bold text-base ${isMain ? "text-primary" : "text-on-surface"}`}>{guide.label}</p>
                                  {isMain && <p className="text-outline text-xs mt-1">Apparaît en premier dans l&apos;annonce</p>}
                                </div>
                                <div className="flex items-center gap-2 bg-primary/8 text-primary text-xs font-semibold px-4 py-2 rounded-full border border-primary/20">
                                  <span className="material-symbols-outlined text-base">add_a_photo</span>
                                  Appuyer pour ajouter
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Nav buttons */}
                      <div className="flex items-center gap-2">
                        {photoStep > 0 && (
                          <button type="button" onClick={() => setPhotoStep((s) => s - 1)}
                            className="w-11 h-11 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                            <span className="material-symbols-outlined">chevron_left</span>
                          </button>
                        )}
                        {img ? (
                          <button type="button"
                            onClick={() => !isLast && setPhotoStep((s) => s + 1)}
                            disabled={isLast}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-primary text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                            {isLast ? "Photos complètes ✓" : <>Suivant <span className="material-symbols-outlined text-base">arrow_forward</span></>}
                          </button>
                        ) : (
                          <button type="button"
                            onClick={() => !isMain && setPhotoStep((s) => s + 1)}
                            disabled={isMain}
                            className={`flex-1 py-3 rounded-full text-sm font-semibold transition-all border ${
                              isMain ? "bg-slate-100 text-slate-400 border-transparent cursor-default" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                            }`}>
                            {isMain ? "Ajoutez d'abord la photo principale" : "Passer cette étape →"}
                          </button>
                        )}
                      </div>

                      {/* Uploaded thumbnails strip */}
                      {doneCount > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 pt-1">
                          {images.map((im, i) => im ? (
                            <button key={i} type="button" onClick={() => setPhotoStep(i)}
                              className={`relative w-14 h-14 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                                i === photoStep ? "border-primary scale-105" : "border-transparent hover:border-slate-300"
                              }`}>
                              <img src={im} alt="" className="absolute inset-0 w-full h-full object-cover blur-sm scale-110 opacity-60" />
                              <img src={im} alt="" className="relative w-full h-full object-contain" />
                              <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                            </button>
                          ) : null)}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <input ref={mainFileRef} type="file" accept="image/*" className="hidden"
                  onChange={async (e) => {
                    await handleImageUpload(e.target.files, 0);
                    setPhotoStep((s) => s === 0 ? 1 : s);
                    e.target.value = "";
                  }} />
                <input ref={extraFileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={async (e) => {
                    const slot = parseInt(extraFileRef.current?.getAttribute("data-slot") ?? "");
                    const target = isNaN(slot) ? photoStep : slot;
                    await handleImageUpload(e.target.files, target);
                    extraFileRef.current?.removeAttribute("data-slot");
                    setPhotoStep((s) => Math.min(s + 1, totalPhotoSteps - 1));
                    e.target.value = "";
                  }} />
              </div>
            )}
          </div>
        )}

        {/* ══ STEP 0 : TITRE ═══════════════════════════════════════════════ */}
        {formStep === 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-extrabold">Titre de l&apos;annonce</h2>
            <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden divide-y divide-slate-100">
              {/* Titre */}
              <div className="px-5 py-4 space-y-2">
                <label className="text-[10px] font-bold text-primary uppercase tracking-widest">Titre de l&apos;annonce *</label>
                <input value={title} autoFocus
                  onChange={(e) => {
                    const v = e.target.value;
                    setTitle(v);
                    if (!userPickedCategory) {
                      const m = detectCategory(v);
                      if (m) { setCategoryId(m.categoryId); setSubcategory(m.subcategory); setAutoDetected(true); }
                      else setAutoDetected(false);
                    }
                  }}
                  className="w-full bg-transparent border-none p-0 text-xl font-bold text-on-surface placeholder:text-slate-300 focus:ring-0 outline-none"
                  placeholder="Que vendez-vous ?" />
              </div>
              {/* Prix */}
              <div className="px-5 py-4 space-y-2">
                <label className="text-[10px] font-bold text-primary uppercase tracking-widest">Prix *</label>
                <div className="flex items-center gap-2">
                  <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0"
                    className="flex-1 bg-transparent border-none p-0 text-3xl font-extrabold text-on-surface placeholder:text-slate-300 focus:ring-0 outline-none"
                    placeholder="0" />
                  <span className="text-2xl font-bold text-slate-300">€</span>
                </div>
              </div>
              {/* Catégorie auto-détectée */}
              {autoDetected && (() => {
                const cat = CATEGORIES.find((c) => c.id === categoryId);
                return (
                  <div className="px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-primary uppercase tracking-widest">Catégorie détectée</label>
                      <button type="button"
                        onClick={() => { setAutoDetected(false); setUserPickedCategory(false); setFormStep(2); }}
                        className="text-[10px] text-outline underline underline-offset-2">Modifier</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 bg-primary/8 text-primary px-3 py-1.5 rounded-full">
                        <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{cat?.icon}</span>
                        <span className="font-bold text-sm">{cat?.label}</span>
                        <span className="material-symbols-outlined text-sm text-emerald-500">check_circle</span>
                      </div>
                    </div>
                    {/* Sous-catégorie inline */}
                    <div className="space-y-2">
                      <p className="text-[10px] text-outline uppercase font-bold tracking-widest">Sous-catégorie</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cat?.subcategories.map((sub) => (
                          <button key={sub} type="button" onClick={() => setSubcategory(sub)} className={pillCls(subcategory === sub)}>{sub}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* Catégorie non détectée — sélecteur rapide */}
              {!autoDetected && title.trim().length > 2 && (
                <div className="px-5 py-4 space-y-3">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Catégorie</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {CATEGORIES.slice(0, 6).map((cat) => (
                      <button key={cat.id} type="button"
                        onClick={() => { setCategoryId(cat.id); setSubcategory(cat.subcategories[0]); setUserPickedCategory(true); }}
                        className={`py-2 px-1 rounded-xl flex flex-col items-center gap-1 transition-all border-2 text-center ${
                          categoryId === cat.id ? "bg-primary/8 border-primary text-primary" : "bg-slate-50 border-transparent text-slate-500 hover:border-slate-200"
                        }`}>
                        <span className="material-symbols-outlined text-lg">{cat.icon}</span>
                        <span className="text-[8px] font-bold uppercase tracking-tight leading-tight">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setFormStep(2)}
                    className="text-xs text-primary font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">expand_more</span>
                    Voir toutes les catégories
                  </button>
                </div>
              )}
            </div>
            {/* Tip */}
          </div>
        )}

        {/* ══ STEP 2 : PRIX + CATÉGORIE (si non détectée) ═════════════════ */}
        {formStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-extrabold">Prix</h2>
            <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden divide-y divide-slate-100">
              {/* Prix */}
              <div className="px-5 py-4 space-y-2">
                <label className="text-[10px] font-bold text-primary uppercase tracking-widest">Prix de vente *</label>
                <div className="flex items-center gap-2">
                  <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" autoFocus
                    className="flex-1 bg-transparent border-none p-0 text-3xl font-extrabold text-on-surface placeholder:text-slate-300 focus:ring-0 outline-none"
                    placeholder="0" />
                  <span className="text-2xl font-bold text-slate-300">€</span>
                </div>
              </div>

              {/* Catégorie — seulement si non détectée automatiquement */}
              {!autoDetected && (
                <div className="px-5 py-4 space-y-3">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest">Catégorie</label>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {CATEGORIES.map((cat) => (
                      <button key={cat.id} type="button"
                        onClick={() => { setCategoryId(cat.id); setSubcategory(cat.subcategories[0]); setUserPickedCategory(true); }}
                        className={`py-2.5 px-1 rounded-xl flex flex-col items-center gap-1 transition-all border-2 ${
                          categoryId === cat.id ? "bg-primary/8 border-primary text-primary" : "bg-slate-50 border-transparent text-slate-500 hover:border-slate-200"
                        }`}>
                        <span className="material-symbols-outlined text-lg" style={categoryId === cat.id ? { fontVariationSettings: "'FILL' 1" } : {}}>{cat.icon}</span>
                        <span className="text-[8px] font-bold uppercase tracking-tight text-center leading-tight">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2 pt-1">
                    <p className="text-[10px] text-outline uppercase font-bold tracking-widest">Sous-catégorie</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIES.find((c) => c.id === categoryId)?.subcategories.map((sub) => (
                        <button key={sub} type="button" onClick={() => setSubcategory(sub)} className={pillCls(subcategory === sub)}>{sub}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Sous-catégorie si catégorie auto-détectée */}
              {autoDetected && (
                <div className="px-5 py-4 space-y-2">
                  <p className="text-[10px] text-outline uppercase font-bold tracking-widest">Sous-catégorie</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.find((c) => c.id === categoryId)?.subcategories.map((sub) => (
                      <button key={sub} type="button" onClick={() => setSubcategory(sub)} className={pillCls(subcategory === sub)}>{sub}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Champs véhicules */}
            {categoryId === "vehicules" && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Caractéristiques du véhicule</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Marque</label>
                    <input value={vehicle.marque} onChange={(e) => setV("marque", e.target.value)} className={inputCls} placeholder="Renault, BMW…" /></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Modèle</label>
                    <input value={vehicle.modele} onChange={(e) => setV("modele", e.target.value)} className={inputCls} placeholder="Clio, Série 3…" /></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Année</label>
                    <input value={vehicle.annee} onChange={(e) => setV("annee", e.target.value)} className={inputCls} placeholder="2021" type="number" /></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Kilométrage</label>
                    <div className="relative"><input value={vehicle.kilometrage} onChange={(e) => setV("kilometrage", e.target.value)} className={inputCls + " pr-10"} placeholder="45 000" type="number" /><span className="absolute right-3 top-3 text-xs text-outline">km</span></div></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Carburant</label>
                    <div className="flex flex-wrap gap-1.5">{FUELS.map((f) => <button key={f} type="button" onClick={() => setV("carburant", f)} className={pillCls(vehicle.carburant === f)}>{f}</button>)}</div></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Boîte</label>
                    <div className="flex gap-2">{TRANSMISSIONS.map((t) => <button key={t} type="button" onClick={() => setV("transmission", t)} className={pillCls(vehicle.transmission === t) + " flex-1"}>{t}</button>)}</div></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Couleur</label>
                    <input value={vehicle.couleur} onChange={(e) => setV("couleur", e.target.value)} className={inputCls} placeholder="Gris, Blanc…" /></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Portes</label>
                    <div className="flex gap-1.5">{["2","3","4","5"].map((n) => <button key={n} type="button" onClick={() => setV("nombrePortes", n)} className={pillCls(vehicle.nombrePortes === n) + " flex-1"}>{n}</button>)}</div></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Puissance</label>
                    <div className="relative"><input value={vehicle.puissanceFiscale} onChange={(e) => setV("puissanceFiscale", e.target.value)} className={inputCls + " pr-8"} placeholder="7" type="number" /><span className="absolute right-3 top-3 text-xs text-outline">CV</span></div></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Immatriculation</label>
                    <input value={vehicle.immatriculation} onChange={(e) => setV("immatriculation", e.target.value.toUpperCase())} className={inputCls + " font-mono tracking-widest"} placeholder="AB-123-CD" maxLength={10} /></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ STEP 3 : DESCRIPTION & ÉTAT ═══════════════════════════════════ */}
        {formStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-extrabold">Description & État</h2>
            {/* Une seule carte — pas de vide entre état et description */}
            <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden divide-y divide-slate-100">
              <div className="px-5 py-4 space-y-3">
                <label className="text-[10px] font-bold text-primary uppercase tracking-widest">État du produit</label>
                <div className="flex flex-wrap gap-2">
                  {CONDITIONS.map((c) => <button key={c} type="button" onClick={() => setCondition(c)} className={pillCls(condition === c)}>{c}</button>)}
                </div>
              </div>
              <div className="px-5 py-4 space-y-2">
                <label className="text-[10px] font-bold text-primary uppercase tracking-widest">Description *</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={7} autoFocus
                  className="w-full bg-transparent border-none p-0 text-base text-on-surface placeholder:text-slate-300 focus:ring-0 leading-relaxed resize-none outline-none"
                  placeholder={"Décrivez votre article :\n— son état précis\n— son âge, son usage\n— les accessoires inclus\n— la raison de la vente"} />
                <p className="text-xs text-outline text-right tabular-nums">{description.length} caractères</p>
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP 4 : COORDONNÉES ═════════════════════════════════════════ */}
        {formStep === 4 && (
          <div className="space-y-5">
            <h2 className="text-2xl font-extrabold">Coordonnées</h2>

            <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden divide-y divide-slate-100">
              {/* Localisation */}
              <div className="px-5 py-4 space-y-2">
                <label className="text-[10px] font-bold text-primary uppercase tracking-widest">Localisation *</label>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl shrink-0">location_on</span>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} autoFocus
                    className="flex-1 bg-transparent border-none p-0 text-base font-semibold text-on-surface placeholder:text-slate-300 focus:ring-0 outline-none"
                    placeholder="Ville, département" />
                </div>
              </div>
              {/* Téléphone */}
              <div className="px-5 py-4 space-y-2">
                <label className="text-[10px] font-bold text-outline uppercase tracking-widest">
                  Téléphone <span className="normal-case font-normal">(facultatif)</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-outline text-xl shrink-0">call</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" maxLength={20}
                    className="flex-1 bg-transparent border-none p-0 text-base text-on-surface placeholder:text-slate-300 focus:ring-0 outline-none"
                    placeholder="06 12 34 56 78" />
                </div>
                {phone.trim() && (
                  <div className="flex items-center gap-3 pt-2 cursor-pointer" onClick={() => setHidePhone((v) => !v)}>
                    <div className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${hidePhone ? "bg-primary" : "bg-slate-200"}`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${hidePhone ? "translate-x-5" : "translate-x-0.5"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">Masquer mon numéro</p>
                      <p className="text-xs text-outline">{hidePhone ? "Messagerie uniquement" : "Numéro visible sur l'annonce"}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {publishError && <p className="text-red-500 text-sm font-medium text-center">{publishError}</p>}

            <p className="text-xs text-outline text-center leading-relaxed">
              En publiant, vous acceptez nos{" "}
              <a href="#" className="underline font-bold text-primary">Conditions d&apos;utilisation</a> et{" "}
              <a href="#" className="underline font-bold text-primary">Règles de publication</a>.
            </p>
          </div>
        )}

      </main>

      {/* ── Bottom nav bar ──────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-100 z-50 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {formStep > 0 && (
            <button type="button" onClick={() => {
              setFormStep((s) => (s - 1) as FormStep);
            }}
              className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors shrink-0">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
          )}

          {formStep < 4 ? (
            <button type="button"
              onClick={() => {
                if (!canAdvance(formStep)) return;
                setFormStep((s) => (s + 1) as FormStep);
              }}
              disabled={!canAdvance(formStep)}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full bg-primary text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-40">
              {formStep === 1 && photoMode === "choose" ? "Passer les photos →" : "Suivant"}
              {formStep !== 0 && <span className="material-symbols-outlined text-base">arrow_forward</span>}
            </button>
          ) : (
            <button type="button" onClick={handlePublish}
              disabled={publishing || !title || !price || !description || !location}
              className="flex-1 py-3.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-white font-bold text-sm shadow-[0_8px_24px_rgba(47,111,184,0.3)] active:scale-95 transition-all disabled:opacity-50">
              {publishing ? "Publication…" : "Publier l'annonce"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

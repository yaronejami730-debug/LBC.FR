"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { CATEGORIES } from "@/lib/categories";
import BrandPicker from "@/components/BrandPicker";
import { ToggleField } from "@/components/ui/Toggle";
import {
  WELLNESS_DURATIONS,
  WELLNESS_PRICE_UNITS,
  WELLNESS_TARIFF_TYPES,
  WELLNESS_PLACES,
} from "@/lib/wellness/publish-fields";
import { inferOfferIntent } from "@/lib/offer-intent";
import { platePolicyFromCategory } from "@/lib/plate-policy";
import { INDEXABILITY_BAR } from "@/lib/seo/indexability";
import { FIELD_SETS } from "@/lib/offer-fields";
// ── Constants ─────────────────────────────────────────────────────────────────

const CONDITIONS = ["Neuf", "Très bon état", "Bon état", "État correct", "Pour pièces"];

/**
 * Ce qu'on demande de décrire, selon ce qui est publié. Le placeholder
 * historique parlait d'« article », d'« état » et d'« accessoires inclus » —
 * incompréhensible pour qui publie une manucure ou une offre d'emploi.
 */
const DESCRIPTION_PLACEHOLDERS: Record<string, string> = {
  objet: "Décrivez votre article :\n— son état précis\n— son âge, son usage\n— les accessoires inclus\n— la raison de la vente",
  prestation: "Décrivez votre prestation :\n— ce qu'elle comprend exactement\n— sa durée et son déroulé\n— où elle a lieu\n— votre expérience",
  logement: "Décrivez le bien :\n— agencement et surfaces\n— étage, exposition, extérieur\n— chauffage et charges\n— quartier et transports",
  poste: "Décrivez le poste :\n— missions principales\n— profil recherché\n— conditions et horaires\n— comment postuler",
  evenement: "Décrivez l'événement :\n— ce qui est prévu\n— date et horaires\n— lieu précis\n— à qui il s'adresse",
  recherche: "Décrivez ce que vous cherchez :\n— caractéristiques attendues\n— votre budget\n— votre secteur\n— sous quel délai",
};
const FUELS      = ["Essence", "Diesel", "Hybride", "Électrique", "GPL", "Autre"];
const TRANSMISSIONS = ["Manuelle", "Automatique"];
const VEHICLE_TYPES = ["Véhicule de tourisme", "Berline", "SUV / 4x4", "Coupé", "Cabriolet / Roadster", "Break", "Monospace", "Pick-up", "Utilitaire", "Camping-car", "Moto", "Scooter", "Autre"];
const CRITAIR = ["0", "1", "2", "3", "4", "5", "Non classé"];
const VEHICLE_EQUIPMENTS = [
  "ABS", "ESP", "Airbags",
  "Climatisation automatique bizone", "Climatisation manuelle",
  "GPS / Navigation", "Interface Bluetooth",
  "Caméra de recul", "Caméra 360°",
  "Régulateur de vitesse", "Limiteur de vitesse",
  "Radar de stationnement avant", "Radar de stationnement arrière",
  "Affichage tête haute", "Détecteur de pluie",
  "Allumage automatique des phares", "Phares xénon", "Phares LED",
  "Rétroviseurs dégivrants", "Rétroviseurs rabattables électriquement",
  "Vitres électriques", "Vitres arrière surteintées",
  "Sièges chauffants", "Sièges électriques à mémoire",
  "Siège conducteur confort", "Siège passager confort",
  "Toit ouvrant panoramique", "Toit ouvrant électrique",
  "Fixations ISOFIX", "Système Start/Stop",
  "Avertisseur d'angle mort", "Sélection du mode de conduite",
  "Contrôle pression pneus (RDC)", "Buses lave-glace chauffantes",
];
const MAX_PHOTOS_DEFAULT = 15;
const MAX_PHOTOS_PRO = 30;

// ── Types ─────────────────────────────────────────────────────────────────────

type PhotoMode = "choose" | "guided" | "free";
type FormStep  = 0 | 1 | 2 | 3 | 4 | 5; // voir STEP ci-dessous

type VehicleFields = {
  marque: string; modele: string; nomModele: string; annee: string; kilometrage: string;
  carburant: string; transmission: string; couleur: string;
  immatriculation: string; dateImmatriculation: string;
  puissanceFiscale: string; nombrePortes: string;
  typeVehicule: string; motorisation: string;
  nombreVitesses: string; nombrePlaces: string;
  emissionCO2: string; consoUrbaine: string; consoExtraUrbaine: string; consoMixte: string;
  critAir: string; equipements: string[];
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
  "w-full box-border rounded-[12px] border-[1.5px] border-form-line bg-white px-4 py-3.5 text-[15px] text-form-ink outline-none transition-colors placeholder:text-form-faint/60 focus:border-form-blue";

/** Intitulé au-dessus d'un champ. */
const labelCls = "text-[13px] font-semibold text-form-label";

/** Titre et sous-titre d'une étape, dans la carte. */
const stepTitleCls = "text-[20px] font-bold text-form-ink";
const stepSubCls   = "mt-1 text-[14px] text-form-muted";

/** Options des champs bien-être — valeurs stockées telles quelles en metadata. */

const pillCls = (active: boolean) =>
  `px-4 py-2 rounded-full text-sm font-semibold transition-all border-[1.5px] ${
    active
      ? "bg-form-blue text-white border-form-blue shadow-[0_4px_12px_rgba(45,86,224,0.25)]"
      : "bg-white border-form-line text-form-muted hover:border-form-blue hover:text-form-blue"
  }`;

/**
 * Encart d'information dans une étape.
 *
 * Remplace les bandeaux jaunes : un fond ambre bordé d'ambre criait « erreur »
 * pour dire « voici ce qui se passe ». Ici la couleur ne sert qu'à distinguer
 * l'état atteint (bleu = en cours, vert = acquis), en teinte légère, dans le
 * même vocabulaire que le reste du formulaire.
 */
function FormNote({
  tone,
  icon,
  children,
}: {
  tone: "info" | "success";
  icon: string;
  children: ReactNode;
}) {
  const frame =
    tone === "success"
      ? "border-emerald-500/25 bg-emerald-500/[0.06]"
      : "border-form-blue/20 bg-form-blue/[0.05]";
  const iconTone = tone === "success" ? "text-emerald-600" : "text-form-blue";

  return (
    <div className={`flex items-start gap-3 rounded-[14px] border px-4 py-3 ${frame}`}>
      <span className={`material-symbols-outlined shrink-0 text-[20px] ${iconTone}`}
        style={{ fontVariationSettings: "'FILL' 1" }}>
        {icon}
      </span>
      <div className="text-[13.5px] leading-snug text-form-body">{children}</div>
    </div>
  );
}

/**
 * Vignette de photo — vide (ajout) ou remplie (aperçu).
 *
 * L'aperçu pose la photo entière sur un fond flou tiré d'elle-même : une photo
 * verticale n'est ni rognée ni posée sur une bande grise.
 *
 * Les commandes remplacer/supprimer restent visibles en permanence. Elles
 * n'apparaissaient qu'au survol, geste qui n'existe pas au doigt : sur mobile,
 * supprimer une photo était impossible sans passer par un appui long qui ne
 * déclenchait rien.
 */
function PhotoTile({
  src,
  ratio,
  label,
  hint,
  icon = "add_a_photo",
  badge,
  onPick,
  onRemove,
}: {
  src?: string;
  ratio: "wide" | "square";
  label?: string;
  hint?: string;
  icon?: string;
  badge?: string | null;
  onPick: () => void;
  onRemove?: () => void;
}) {
  const shape = ratio === "wide" ? "aspect-[4/3]" : "aspect-square";

  if (!src) {
    return (
      <button type="button" onClick={onPick}
        className={`group flex ${shape} w-full flex-col items-center justify-center gap-2 rounded-[16px] border-[1.5px] border-dashed border-form-dash bg-form-soft px-3 text-center transition-colors hover:border-form-blue hover:bg-form-blue/[0.04]`}>
        <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-form-blue/10">
          <span className="material-symbols-outlined text-[22px] text-form-blue">{icon}</span>
        </span>
        {label && <span className="text-[13px] font-semibold text-form-blue">{label}</span>}
        {hint && <span className="text-[11.5px] leading-snug text-form-muted">{hint}</span>}
      </button>
    );
  }

  return (
    <div className={`relative ${shape} w-full overflow-hidden rounded-[16px] border border-form-line`}>
      <img src={src} alt="" aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
      <img src={src} alt={label ?? "Photo de l'annonce"} className="relative h-full w-full object-contain" />

      {label && (
        <span className="absolute left-3 top-3 rounded-full bg-form-ink/65 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          {label}
        </span>
      )}

      {badge && (
        <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
          <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>blur_on</span>
          {badge}
        </span>
      )}

      <div className="absolute right-2.5 top-2.5 flex gap-1.5">
        <button type="button" onClick={onPick} aria-label="Remplacer la photo"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-form-ink shadow-sm backdrop-blur-sm transition-colors hover:bg-white">
          <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
        </button>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label="Supprimer la photo"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-form-ink shadow-sm backdrop-blur-sm transition-colors hover:bg-red-500 hover:text-white">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Step labels ───────────────────────────────────────────────────────────────

// Source unique de la numérotation des étapes : pas de `formStep === 2` en dur
// ailleurs, sinon un réordonnancement casse les liens « Modifier » du récap.
const STEP = { TITLE: 0, PHOTOS: 1, DESC: 2, PRICE: 3, CONTACT: 4, RECAP: 5 } as const;

const STEP_LABELS = ["Titre", "Photos", "Description", "Prix", "Coordonnées", "Récap"];

// ── Tips per step ─────────────────────────────────────────────────────────────


// ── Component ─────────────────────────────────────────────────────────────────

export default function PostForm() {
  const router = useRouter();
  const { data: session, update: updateSession, status } = useSession();
  const isPro = Boolean((session?.user as { isPro?: boolean } | undefined)?.isPro);
  const MAX_PHOTOS = isPro ? MAX_PHOTOS_PRO : MAX_PHOTOS_DEFAULT;

  /**
   * Barre de qualité qui décide si l'annonce sera référencée.
   *
   * Lue depuis `lib/seo/indexability.ts`, jamais recopiée : c'est la même
   * constante qui pose le `noindex` et qui remplit le sitemap. Un chiffre
   * affiché ici qui ne serait pas celui appliqué là-bas serait pire que pas de
   * chiffre du tout — on promettrait une visibilité qu'on ne donne pas.
   */
  const seoBar = isPro ? INDEXABILITY_BAR.pro : INDEXABILITY_BAR.particulier;

  // Auth gate state
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [gateEmail, setGateEmail] = useState("");
  const [gatePassword, setGatePassword] = useState("");
  const [gateError, setGateError] = useState("");
  const [gateLoading, setGateLoading] = useState(false);

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
  /** Ce numéro répond-il sur WhatsApp ? Demandé, jamais supposé. */
  const [phoneOnWhatsapp, setPhoneOnWhatsapp] = useState(false);
  const [hidePhone,   setHidePhone]   = useState(false);

  /**
   * Casquette de publication.
   *
   * Un compte particulier devenu professionnel garde les deux usages : il vend
   * son canapé le samedi et son stock la semaine. Le choix conditionne la
   * précision de l'adresse publiée — complète pour un local commercial, réduite
   * à la commune pour un domicile.
   */
  const [postedAs, setPostedAs] = useState<"PARTICULIER" | "PRO">("PARTICULIER");
  const [postingCaps, setPostingCaps] = useState<{
    mustChoose: boolean;
    canPostAsPro: boolean;
    canPostAsPrivate: boolean;
    companyName: string | null;
  } | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);
  /** Suggestion en cours de calcul — évite un clignotement à chaque frappe. */
  const [detecting, setDetecting] = useState(false);
  const [userPickedCategory, setUserPickedCategory] = useState(false);

  /**
   * Suggestion de catégorie, à distance.
   *
   * Trois raisons de ne plus classer dans le navigateur : l'index pèse
   * 537 Ko et n'a rien à faire dans le bundle ; le calcul bloquait la frappe ;
   * et le moteur évolue sans qu'il faille redéployer le client.
   *
   * 350 ms d'attente après la dernière touche : assez pour ne pas interroger à
   * chaque caractère, assez peu pour que la catégorie apparaisse pendant qu'on
   * réfléchit au prix. Un choix manuel gèle définitivement la suggestion —
   * c'est l'utilisateur qui a le dernier mot, jamais le moteur.
   */
  useEffect(() => {
    if (userPickedCategory) return;
    if (title.trim().length < 3) {
      setAutoDetected(false);
      return;
    }

    const controller = new AbortController();
    setDetecting(true);
    const timer = window.setTimeout(() => {
      fetch("/api/category/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((data) => {
          const result = data.result as
            | { status: string; categoryId: string | null; subcategory: string | null }
            | null;
          // « Ambigu » n'impose rien : le formulaire laisse choisir plutôt que
          // de deviner. C'est ce qui évite de publier un lit bébé en salon.
          if (result && result.categoryId && (result.status === "auto" || result.status === "suggested")) {
            setCategoryId(result.categoryId);
            setSubcategory(result.subcategory ?? "");
            setAutoDetected(true);
          } else {
            setAutoDetected(false);
          }
        })
        .catch(() => {})
        .finally(() => setDetecting(false));
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
      setDetecting(false);
    };
  }, [title, userPickedCategory]);
  // Bien-être : le moteur déduit durée/capacité/unité d'un titre bien écrit,
  // mais ne devine rien d'un titre pauvre — et un acheteur qui compare deux
  // hammams a besoin que ce soit déclaré. Ces champs priment sur l'extraction.
  const [wellness, setWellness] = useState({
    durationMin: "",
    priceUnit: "",
    tariffType: "fixe",
    place: "",
  });
  const setW = (k: keyof typeof wellness, v: string) =>
    setWellness((prev) => ({ ...prev, [k]: v }));

  /**
   * Ce que l'annonce vend réellement, déduit du titre autant que de la
   * rubrique. C'est ce qui décide des champs affichés : demander « État du
   * produit » pour une manucure était le défaut d'origine — une prestation n'a
   * pas d'état, et le mot « article » n'a pas de sens non plus.
   */
  const intent = useMemo(
    () =>
      inferOfferIntent({
        title,
        description,
        categoryId,
        subcategory,
        price: price ? parseFloat(price) : null,
        isPro,
      }),
    [title, description, categoryId, subcategory, price, isPro],
  );
  /**
   * L'annonceur garde le dernier mot. Le moteur propose un régime de champs,
   * un clic le ramène au régime « objet » — sans quoi une détection ratée
   * enferme quelqu'un dans un formulaire qui ne lui convient pas.
   */
  const [regimeOverride, setRegimeOverride] = useState<"bien" | null>(null);
  const fieldSpec = FIELD_SETS[regimeOverride ?? intent.fieldSet];

  /** Valeurs des champs déclarés en données par le régime (metadata.fields). */
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  const setExtra = (id: string, v: string) => setExtraFields((prev) => ({ ...prev, [id]: v }));

  const [vehicle, setVehicle] = useState<VehicleFields>({
    marque: "", modele: "", nomModele: "", annee: "", kilometrage: "",
    carburant: "Essence", transmission: "Manuelle",
    couleur: "", immatriculation: "", dateImmatriculation: "",
    puissanceFiscale: "", nombrePortes: "5",
    typeVehicule: "Véhicule de tourisme", motorisation: "",
    nombreVitesses: "", nombrePlaces: "",
    emissionCO2: "", consoUrbaine: "", consoExtraUrbaine: "", consoMixte: "",
    critAir: "", equipements: [],
  });
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

  // Photo state
  const [images,      setImages]      = useState<string[]>([]);
  const [photoMode,   setPhotoMode]   = useState<PhotoMode>("choose");
  const [photoStep,   setPhotoStep]   = useState(0);
  const [uploading,       setUploading]       = useState(false);
  const [plateDetecting,  setPlateDetecting]  = useState(false);
  // url → nombre de plaques floutées (0 = aucune, >0 = floutée)
  const [plateStatus, setPlateStatus] = useState<Record<string, number>>({});


  // AI assist state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState<string | null>(null);

  // Publish state
  const [publishing,    setPublishing]    = useState(false);
  const [publishError,  setPublishError]  = useState<string | null>(null);
  const [rejection,     setRejection]     = useState<{ id: string; reason: string | null; isProActivity?: boolean } | null>(null);

  const mainFileRef  = useRef<HTMLInputElement>(null);
  const extraFileRef = useRef<HTMLInputElement>(null);

  // Init photo mode from preference
  useEffect(() => {
    setPhotoMode(getAutoMode());
  }, []);

  // Casquettes de publication autorisées pour ce compte.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile/posting-mode")
      .then((r) => (r.ok ? r.json() : null))
      .then((caps) => {
        if (cancelled || !caps) return;
        setPostingCaps(caps);
        // Un compte purement professionnel n'a rien à choisir : sa casquette
        // par défaut est la seule qu'il possède.
        if (!caps.mustChoose && caps.canPostAsPro) setPostedAs("PRO");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Brouillon : restauration + sauvegarde automatique ───────────────────────
  // Reprise d'une publication interrompue + alimente le moteur anti-friction
  // (un brouillon dont `updatedAt` traîne sans annonce derrière = abandon).
  const draftRestored = useRef(false);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Référence vivante des champs déclencheurs du garde anti-écrasement.
  // Sans ce ref, le garde lirait les valeurs *capturées* dans la closure
  // au moment où l'effet a démarré — une saisie pendant le fetch /api/drafts
  // serait alors silencieusement écrasée par le brouillon serveur.
  const liveDraftGuard = useRef({ title, description, price, images });
  liveDraftGuard.current = { title, description, price, images };

  // Restauration au montage — utilisateur connecté uniquement.
  useEffect(() => {
    if (draftRestored.current) return;
    if (status === "loading") return;   // session pas encore connue
    if (!session?.user) return;         // anonyme → pas de brouillon serveur
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/drafts");
        if (!res.ok) return;
        const { draft } = (await res.json()) as { draft: { payload: string } | null };
        if (cancelled) return;
        // Pas de brouillon → essai de pré-remplissage à partir de l'historique
        // (dernière annonce, waitlist, médiane catégorie). Ne s'applique que
        // sur un formulaire encore vierge.
        if (!draft) {
          const liveNoDraft = liveDraftGuard.current;
          if (liveNoDraft.title || liveNoDraft.description || liveNoDraft.price || liveNoDraft.images.length) return;
          try {
            const pr = await fetch("/api/behavioral/prefill");
            if (cancelled || !pr.ok) return;
            const { prefill } = (await pr.json()) as {
              prefill: { category: string; fields: Record<string, unknown>; estimatedPrice?: number } | null;
            };
            if (!prefill) return;
            const f = prefill.fields;
            if (prefill.category) setCategoryId(prefill.category);
            if (typeof f.subcategory === "string") setSubcategory(f.subcategory);
            if (typeof f.location === "string") setLocation(f.location);
            if (prefill.estimatedPrice) setPrice(String(prefill.estimatedPrice));
            if (prefill.category === "vehicules") {
              setVehicle((v) => {
                const merged = { ...v };
                for (const k of Object.keys(v) as (keyof typeof v)[]) {
                  const val = f[k as string];
                  if (typeof val === "string") (merged[k] as unknown) = val;
                }
                return merged;
              });
            } else if (prefill.category === "immobilier") {
              setImmo((i) => {
                const merged = { ...i };
                for (const k of Object.keys(i) as (keyof typeof i)[]) {
                  const val = f[k as string];
                  if (typeof val === "string") (merged[k] as unknown) = val;
                  else if (typeof val === "number") (merged[k] as unknown) = String(val);
                }
                return merged;
              });
            }
          } catch { /* prefill HS — saisie vierge */ }
          return;
        }
        // N'écrase rien si l'utilisateur a déjà commencé à saisir.
        // Lecture via ref → valeurs vivantes, pas la closure d'origine.
        const live = liveDraftGuard.current;
        if (live.title || live.description || live.price || live.images.length) return;
        const d = JSON.parse(draft.payload) as Record<string, unknown>;
        if (typeof d.title === "string") setTitle(d.title);
        if (typeof d.price === "string") setPrice(d.price);
        if (typeof d.categoryId === "string") setCategoryId(d.categoryId);
        if (typeof d.subcategory === "string") setSubcategory(d.subcategory);
        if (typeof d.description === "string") setDescription(d.description);
        if (typeof d.location === "string") setLocation(d.location);
        if (typeof d.condition === "string") setCondition(d.condition);
        if (typeof d.phone === "string") setPhone(d.phone);
        if (typeof d.phoneOnWhatsapp === "boolean") setPhoneOnWhatsapp(d.phoneOnWhatsapp);
        if (typeof d.hidePhone === "boolean") setHidePhone(d.hidePhone);
        if (d.vehicle && typeof d.vehicle === "object") setVehicle((v) => ({ ...v, ...(d.vehicle as object) }));
        if (d.immo && typeof d.immo === "object") setImmo((v) => ({ ...v, ...(d.immo as object) }));
        if (Array.isArray(d.images)) setImages((d.images as unknown[]).filter((x): x is string => typeof x === "string"));
        // Clamp formStep : protège contre payload corrompu (PUT manuel sur
        // /api/drafts, valeur hors-bornes) et contre une contraction future
        // de STEP_LABELS qui invaliderait d'anciennes valeurs persistées.
        if (typeof d.formStep === "number" && Number.isInteger(d.formStep)) {
          const clamped = Math.max(0, Math.min(STEP_LABELS.length - 1, d.formStep));
          setFormStep(clamped as FormStep);
        }
      } catch {
        /* brouillon illisible — ignoré */
      } finally {
        if (!cancelled) draftRestored.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, status]);

  // Sauvegarde automatique débattue — 2,5 s après la dernière modification.
  useEffect(() => {
    if (!draftRestored.current || !session?.user) return;
    const filledRequired =
      (title.trim() ? 1 : 0) +
      (description.trim() ? 1 : 0) +
      (location.trim() ? 1 : 0) +
      (price.trim() ? 1 : 0) +
      (images.length ? 1 : 0);
    if (filledRequired === 0) return; // formulaire vide → aucun brouillon créé
    const completeness = Math.round((filledRequired / 5) * 100);
    const payload = JSON.stringify({
      title, price, categoryId, subcategory, description, location,
      condition, phone, hidePhone, phoneOnWhatsapp, vehicle, immo, images, formStep,
    });

    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      fetch("/api/drafts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, category: categoryId, step: formStep, completeness }),
      }).catch(() => {});
    }, 2500);
    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, price, categoryId, subcategory, description, location, condition,
      phone, hidePhone, phoneOnWhatsapp, vehicle, immo, images, formStep, session?.user]);

  function setI<K extends keyof ImmobilierFields>(field: K, value: ImmobilierFields[K]) {
    setImmo((v) => ({ ...v, [field]: value }));
  }
  function toggleCarac(item: string) {
    setImmo((v) => ({
      ...v,
      caracteristiques: v.caracteristiques.includes(item)
        ? v.caracteristiques.filter((c) => c !== item)
        : [...v.caracteristiques, item],
    }));
  }

  function toggleEquip(item: string) {
    setVehicle((v) => ({
      ...v,
      equipements: v.equipements.includes(item)
        ? v.equipements.filter((e) => e !== item)
        : [...v.equipements, item],
    }));
  }

  function setV(field: keyof VehicleFields, value: string) {
    setVehicle((v) => ({ ...v, [field]: value }));
  }

  function pickMode(mode: "guided" | "free") {
    savePref(mode);
    setPhotoMode(mode);
  }

  // ── Plate detection + client-side blur ───────────────────────────────────────

async function detectAndBlurPlates(file: File): Promise<{ file: File; platesFound: number }> {
    try {
      console.log("[PlateDetect] start —", file.name, file.type, file.size);

      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/detect-plate", { method: "POST", body: form });
      const json = await res.json() as { boxes?: { xmin: number; ymin: number; xmax: number; ymax: number }[] };
      console.log("[PlateDetect] response:", JSON.stringify(json));
      const { boxes } = json;
      if (!boxes || boxes.length === 0) return { file, platesFound: 0 };

      const blurredFile = await new Promise<File>((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);

          for (const box of boxes) {
            // Raw pixel coords from Plate Recognizer — apply directly, canvas = full image
            const pad = Math.round((box.xmax - box.xmin) * 0.20);
            const bx = Math.max(0, box.xmin - pad);
            const by = Math.max(0, box.ymin - pad);
            const bw = Math.min(canvas.width - bx, (box.xmax - box.xmin) + pad * 2);
            const bh = Math.min(canvas.height - by, (box.ymax - box.ymin) + pad * 2);
            if (bw <= 0 || bh <= 0) continue;

            console.log("[PlateDetect] blur px:", { bx, by, bw, bh });

            const FACTOR = 10;
            const sw = Math.max(2, Math.round(bw / FACTOR));
            const sh = Math.max(2, Math.round(bh / FACTOR));
            const tmp = document.createElement("canvas");
            tmp.width = sw; tmp.height = sh;
            const tCtx = tmp.getContext("2d")!;
            tCtx.drawImage(canvas, bx, by, bw, bh, 0, 0, sw, sh);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(tmp, 0, 0, sw, sh, bx, by, bw, bh);
            ctx.imageSmoothingEnabled = true;
          }

          canvas.toBlob(
            (blob) => {
              if (!blob) { reject(new Error("Canvas export failed")); return; }
              console.log("[PlateDetect] blur done, blob size:", blob.size);
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            },
            "image/jpeg",
            0.96,
          );
        };
        img.onerror = (e) => { URL.revokeObjectURL(objectUrl); console.error("[PlateDetect] img load error", e); reject(new Error("Image load failed")); };
        img.src = objectUrl;
      });

      return { file: blurredFile, platesFound: boxes.length };
    } catch (err) {
      console.error("[PlateDetect] error:", err);
      return { file, platesFound: 0 };
    }
  }

  // ── Upload ───────────────────────────────────────────────────────────────────

  async function handleImageUpload(files: FileList | null, slotIndex?: number) {
    if (!files || files.length === 0) return;
    if (images.length >= MAX_PHOTOS && slotIndex === undefined) return;
    setUploading(true);
    setPublishError(null);
    try {
      const uploads: string[] = [];
      for (const rawFile of Array.from(files)) {
        let uploadFile = rawFile;
        let clientPlatesFound = 0;

        // La détection de plaques ne concerne que les rubriques où un véhicule
        // peut se trouver. Elle tournait sur chaque photo de chaque annonce —
        // un appel facturé et jusqu'à quinze secondes d'attente pour chercher
        // une immatriculation sur un canapé ou une manucure.
        const platePolicy = platePolicyFromCategory(categoryId, subcategory);

        if (platePolicy.verdict !== "skip") {
          setPlateDetecting(true);
          try {
            const result = await detectAndBlurPlates(rawFile);
            uploadFile = result.file;
            clientPlatesFound = result.platesFound;
          } catch {
            // silent fallback — upload original
          } finally {
            setPlateDetecting(false);
          }
        }

        const form = new FormData();
        form.append("file", uploadFile);
        // Le serveur retranche la même décision plutôt que de croire le client :
        // au pire, une requête forgée provoque une analyse inutile.
        form.append("usage", "listing");
        form.append("category", categoryId);
        form.append("subcategory", subcategory);
        form.append("title", title);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Erreur d'envoi");
        }
        const data = await res.json();
        if (!data.url) throw new Error("Réponse invalide");
        uploads.push(data.url);
        const totalPlates = Math.max(clientPlatesFound, typeof data.platesFound === "number" ? data.platesFound : 0);
        if (totalPlates > 0) {
          setPlateStatus((prev) => ({ ...prev, [data.url]: totalPlates }));
        }
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
    const url = images[index];
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (url) setPlateStatus((prev) => { const next = { ...prev }; delete next[url]; return next; });
  }

  // ── Publish ──────────────────────────────────────────────────────────────────

  async function handleGateLogin(e: React.FormEvent) {
    e.preventDefault();
    setGateError("");
    setGateLoading(true);
    const result = await signIn("credentials", {
      email: gateEmail.trim().toLowerCase(),
      password: gatePassword,
      redirect: false,
    });
    setGateLoading(false);
    if (!result?.ok || result.error) {
      setGateError("Email ou mot de passe incorrect.");
      return;
    }
    await updateSession();
    setShowAuthGate(false);
    setTimeout(() => handlePublish(), 150);
  }

  async function handlePublish() {
    if (!title || !price || !description || !location) return;
    if (!session) {
      setShowAuthGate(true);
      return;
    }
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
          description, location, postedAs,
          // L'état n'est envoyé que s'il a un sens. Sur une prestation, le
          // laisser passer réintroduirait la valeur fausse en base — le serveur
          // le rejette aussi, mais autant ne pas la fabriquer.
          ...(fieldSpec.core.condition ? { condition } : {}),
          images: images.filter(Boolean),
          metadata: fieldSpec.core.serviceDetails
            ? JSON.stringify({
                durationMin: wellness.durationMin || null,
                priceUnit: wellness.priceUnit || null,
                tariffType: wellness.tariffType,
                place: wellness.place || null,
                ...(Object.keys(extraFields).length > 0 ? { fields: extraFields } : {}),
              })
            : categoryId === "vehicules"
            ? JSON.stringify({ ...vehicle })
            : categoryId === "immobilier"
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
                ...(Object.keys(extraFields).length > 0 ? { fields: extraFields } : {}),
              })
            : Object.keys(extraFields).length > 0
            ? JSON.stringify({ fields: extraFields })
            : "{}",
          phone: phone.trim() || null, hidePhone,
          phoneOnWhatsapp: phone.trim() ? phoneOnWhatsapp : false,
        }),
      });
      if (res.status === 401) { router.push("/login?callbackUrl=/post"); return; }
      const text = await res.text();
      let data: { id?: string; error?: string; status?: string; rejectionReason?: string | null } = {};
      try { data = JSON.parse(text); } catch { /* html error page */ }
      if (!res.ok) { setPublishError(data.error || `Erreur ${res.status}`); return; }
      if (!data.id) { setPublishError("Réponse inattendue. Réessayez."); return; }
      // Annonce créée — le brouillon n'a plus lieu d'être.
      fetch("/api/drafts", { method: "DELETE" }).catch(() => {});
      if (data.status === "REJECTED") {
        setRejection({
          id: data.id,
          reason: data.rejectionReason ?? null,
          isProActivity: typeof (data as any).rejectedForProActivity === "boolean" ? (data as any).rejectedForProActivity : undefined,
        });
        return;
      }
      router.push(`/annonce/${data.id}`);
    } catch {
      setPublishError("Impossible de joindre le serveur.");
    } finally {
      setPublishing(false);
    }
  }

  // ── AI assist ────────────────────────────────────────────────────────────────

  async function handleAiAssist() {
    if (!title) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const cat = CATEGORIES.find((c) => c.id === categoryId);
      const res = await fetch("/api/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category: cat?.label || categoryId,
          subcategory: subcategory || null,
          imageUrl: images[0] || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur IA");
      if (data.description) setDescription(data.description);
      if (data.titre && !title.trim()) setTitle(data.titre);
      if (data.etat && CONDITIONS.includes(data.etat)) setCondition(data.etat);
      if (data.prixMin && data.prixMax && !price) {
        const mid = Math.round((data.prixMin + data.prixMax) / 2);
        setPrice(String(mid));
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Erreur lors de la génération");
    } finally {
      setAiLoading(false);
    }
  }

  // ── Step validation ───────────────────────────────────────────────────────────

  function canAdvance(step: FormStep): boolean {
    if (step === STEP.TITLE)  return title.trim().length > 0;       // titre obligatoire
    if (step === STEP.PHOTOS) return true;                          // photos optionnelles
    if (step === STEP.DESC)   return description.trim().length > 0;
    if (step === STEP.PRICE)  return price.trim().length > 0;       // prix obligatoire
    return true;
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const guides    = getGuides(categoryId);
  const totalPhotoSteps = 1 + guides.length;
  const doneCount = images.filter(Boolean).length;

  const stepsLeft = STEP_LABELS.length - 1 - formStep;
  const stepsLeftLabel =
    stepsLeft === 0 ? "Dernière vérification avant la mise en ligne."
    : stepsLeft === 1 ? "Encore une étape avant la mise en ligne."
    : `Encore ${stepsLeft} étapes avant la mise en ligne.`;

  if (rejection) {
    return (
      <div className="bg-[#f7f8fc] text-on-surface min-h-screen pb-32">
        <header className="bg-white fixed top-0 w-full z-50 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between px-5 py-3 max-w-2xl mx-auto">
            <Link href="/" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500">
              <span className="material-symbols-outlined text-xl">close</span>
            </Link>
            <img src="/logo.png" alt="Deal&Co" className="h-9 w-auto" />
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-5 pt-24">
          <div className="bg-white rounded-3xl border border-red-100 shadow-sm p-6 md:p-8">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-500 text-2xl">block</span>
              </span>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">
                  Annonce non publiée
                </h1>
                <p className="text-sm text-outline mt-1">
                  Notre modération automatique a refusé cette annonce.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-red-50 border border-red-100 p-4">
              <p className="text-sm font-bold text-red-700 mb-1">Motif</p>
              <p className="text-sm text-red-700/90 leading-relaxed">
                {rejection.reason ?? "Le contenu de l'annonce ne respecte pas nos règles de publication."}
              </p>
            </div>

            {rejection.isProActivity && (
              <div className="mt-4 rounded-2xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-sm font-bold text-blue-800 mb-1">Activité professionnelle détectée</p>
                <p className="text-sm text-blue-800/80 leading-relaxed">
                  Cette annonce semble relever d&apos;une activité commerciale. Passez sur un compte professionnel
                  pour publier vos annonces avec un badge de confiance et des outils dédiés.
                </p>
                <Link
                  href="/profile?tab=pro"
                  className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full font-semibold text-sm"
                >
                  Activer mon compte pro
                </Link>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <p className="text-sm font-semibold text-on-surface">Que faire maintenant ?</p>
              <ul className="text-sm text-on-surface-variant space-y-1.5 list-disc pl-5">
                <li>Modifier votre annonce pour corriger le motif et la soumettre à nouveau.</li>
                <li>Recommencer une annonce différente si le sujet n&apos;est pas autorisé.</li>
                <li>
                  Nous contacter via{" "}
                  <a href="mailto:contact@dealandcompany.fr" className="text-primary font-semibold underline">
                    contact@dealandcompany.fr
                  </a>{" "}
                  si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
                </li>
              </ul>
            </div>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Link
                href={`/annonce/${rejection.id}/edit`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-bold shadow-md active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
                Modifier mon annonce
              </Link>
              <button
                type="button"
                onClick={() => {
                  setRejection(null);
                  setPublishError(null);
                  setFormStep(STEP.TITLE);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-surface-container text-on-surface rounded-full font-semibold hover:bg-slate-50 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">refresh</span>
                Recommencer
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-form-canvas text-form-ink">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="w-full border-b border-form-edge bg-white">
        <div className="mx-auto flex w-full max-w-[1080px] items-center justify-between px-6 py-5 sm:px-10">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Quitter le dépôt d'annonce"
              className="flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-form-faint transition-colors hover:bg-form-canvas hover:text-form-ink">
              ×
            </Link>
            <img src="/logo.png" alt="Deal&Co" className="h-8 w-auto" />
          </div>
          <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-form-blue-deep">Nouvelle annonce</span>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-7 px-6 pt-12 pb-20">

        {/* Titre de page + décompte restant */}
        <div>
          <h1 className="bg-gradient-to-br from-form-blue-dark to-form-blue bg-clip-text text-[32px] font-extrabold leading-[1.15] tracking-[-0.025em] text-transparent sm:text-[36px]">
            Publier une annonce
          </h1>
          <p className="mt-2 text-[15.5px] text-form-muted">{stepsLeftLabel}</p>
        </div>

        {/* Progression */}
        <div>
          <div className="flex items-center gap-2">
            {STEP_LABELS.map((label, i) => (
              <div key={label}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  i < formStep ? "bg-form-blue-deep" : i === formStep ? "bg-form-blue" : "bg-form-edge"
                }`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11.5px] font-semibold">
            {STEP_LABELS.map((label, i) => (
              <span key={label}
                className={`flex-1 text-center ${
                  i === formStep ? "text-form-blue" : i < formStep ? "text-form-blue-deep" : "text-form-faint/60"
                }`}>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Carte d'étape — `key` sur l'étape pour rejouer le fondu à chaque
            changement d'écran, sinon le passage d'une étape à l'autre est un
            saut sec. */}
        <div key={formStep}
          className="form-card-in rounded-[20px] border border-form-edge bg-white p-6 shadow-[0_1px_2px_rgba(24,28,45,0.04),0_12px_32px_rgba(24,28,45,0.06)] sm:p-10">

        {/* ══ ÉTAPE PHOTOS ══════════════════════════════════════════════════ */}
        {formStep === STEP.PHOTOS && (
          <div className="flex flex-col gap-[22px]">
            <div>
              <h2 className={stepTitleCls}>Ajoutez des photos</h2>
              <p className={stepSubCls}>Les annonces avec photos reçoivent bien plus de réponses. Jusqu&apos;à {MAX_PHOTOS}, toutes gratuites.</p>
            </div>

            {/*
              L'avertissement « floutez vos plaques » a disparu d'ici.
              Il réclamait au vendeur un geste que le serveur fait désormais
              lui-même : les photos de véhicule passent par la détection de
              plaques, qui les floute avant l'enregistrement. Le résultat est
              annoncé sur la vignette concernée (« Plaque floutée ») — on montre
              ce qui a été fait au lieu d'exiger ce qui ne dépend plus de lui.
            */}

            {/* Jauge de visibilité — voir `seoBar` plus haut. */}
            {doneCount > 0 && doneCount < seoBar.minImages && (
              <FormNote tone="info" icon="photo_library">
                Encore{" "}
                <strong className="font-bold text-form-ink">
                  {seoBar.minImages - doneCount} photo{seoBar.minImages - doneCount > 1 ? "s" : ""}
                </strong>{" "}
                et votre annonce apparaîtra dans les résultats Google.
                <span className="mt-0.5 block text-form-muted">
                  En dessous de {seoBar.minImages} photos, elle reste visible sur Deal&amp;Co mais n&apos;est pas référencée.
                </span>
              </FormNote>
            )}
            {doneCount >= seoBar.minImages && (
              <FormNote tone="success" icon="check_circle">
                Assez de photos pour être référencée sur Google.
              </FormNote>
            )}

            {/* ── Mode "choose" ── */}
            {photoMode === "choose" && (
              <div className="flex flex-col gap-3">
                <p className={labelCls}>Comment souhaitez-vous ajouter vos photos ?</p>
                <button type="button" onClick={() => pickMode("guided")}
                  className="flex items-center gap-4 rounded-[16px] border-[1.5px] border-form-blue/30 bg-form-blue/[0.04] p-4 text-left transition-all hover:border-form-blue active:scale-[0.99]">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-form-blue/10">
                    <span className="material-symbols-outlined text-2xl text-form-blue">auto_awesome</span>
                  </span>
                  <span className="flex-1">
                    <span className="block font-bold text-form-ink">Aide à la photo</span>
                    <span className="mt-0.5 block text-[13px] text-form-muted">On vous guide angle par angle, pour une annonce qui vend mieux</span>
                  </span>
                  <span className="material-symbols-outlined shrink-0 text-form-blue">chevron_right</span>
                </button>
                <button type="button" onClick={() => pickMode("free")}
                  className="flex items-center gap-4 rounded-[16px] border-[1.5px] border-form-line bg-white p-4 text-left transition-all hover:border-form-dash active:scale-[0.99]">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-form-soft">
                    <span className="material-symbols-outlined text-2xl text-form-faint">photo_library</span>
                  </span>
                  <span className="flex-1">
                    <span className="block font-bold text-form-ink">Ajouter mes photos</span>
                    <span className="mt-0.5 block text-[13px] text-form-muted">Je gère mes photos moi-même, librement</span>
                  </span>
                  <span className="material-symbols-outlined shrink-0 text-form-faint">chevron_right</span>
                </button>
              </div>
            )}

            {/* ── Mode "free" : slots progressifs ── */}
            {photoMode === "free" && (() => {
              // Premier emplacement libre : c'est lui que vise la tuile « Ajouter ».
              let nextSlot = -1;
              for (let i = 0; i < MAX_PHOTOS; i++) {
                if (!images[i]) { nextSlot = i; break; }
              }
              const secondary = images
                .map((im, i) => ({ im, i }))
                .filter((s) => s.im && s.i !== 0);

              function pick(slot: number) {
                extraFileRef.current?.setAttribute("data-slot", String(slot));
                extraFileRef.current?.click();
              }

              return (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-form-label">
                      <span className="tabular-nums text-form-ink">{doneCount}</span> / {MAX_PHOTOS} photos
                    </p>
                    <button type="button" onClick={() => setPhotoMode("choose")}
                      className="text-[12px] font-semibold text-form-muted underline underline-offset-2 hover:text-form-blue">
                      Changer de mode
                    </button>
                  </div>

                  {/* Photo principale — celle qui s'affiche dans les résultats */}
                  <PhotoTile
                    src={images[0]}
                    ratio="wide"
                    label={images[0] ? "Principale" : "Ajouter la photo principale"}
                    hint={images[0] ? undefined : "Elle s'affiche en premier dans les résultats"}
                    badge={images[0] && plateStatus[images[0]] > 0 ? "Plaque floutée" : null}
                    onPick={() => pick(0)}
                    onRemove={images[0] ? () => removeImage(0) : undefined}
                  />

                  {/* Photos suivantes */}
                  {(secondary.length > 0 || (images[0] && nextSlot > 0)) && (
                    <div className="grid grid-cols-3 gap-3">
                      {secondary.map(({ im, i }) => (
                        <PhotoTile
                          key={i}
                          src={im}
                          ratio="square"
                          badge={plateStatus[im] > 0 ? "Floutée" : null}
                          onPick={() => pick(i)}
                          onRemove={() => removeImage(i)}
                        />
                      ))}
                      {nextSlot > 0 && (
                        <PhotoTile ratio="square" icon="add" label="Ajouter" onPick={() => pick(nextSlot)} />
                      )}
                    </div>
                  )}

                  {(uploading || plateDetecting) && (
                    <FormNote tone="info" icon="hourglass_top">
                      {plateDetecting ? "Analyse des plaques d'immatriculation…" : "Envoi de la photo…"}
                    </FormNote>
                  )}

                  <input ref={mainFileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden"
                    onChange={(e) => { handleImageUpload(e.target.files, 0); e.target.value = ""; }} />
                  <input ref={extraFileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple className="hidden"
                    onChange={(e) => {
                      const slot = parseInt(extraFileRef.current?.getAttribute("data-slot") ?? "");
                      handleImageUpload(e.target.files, isNaN(slot) ? undefined : slot);
                      extraFileRef.current?.removeAttribute("data-slot");
                      e.target.value = "";
                    }} />
                </div>
              );
            })()}

            {/* ── Mode "guided" : stepper ── */}
            {photoMode === "guided" && (
              <div className="flex flex-col gap-4">
                {/* Header guided */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-form-label">
                      Angle <span className="text-form-blue">{photoStep + 1}</span> / {totalPhotoSteps}
                    </p>
                    {doneCount > 0 && (
                      <p className="text-[12px] font-semibold text-emerald-600">
                        {doneCount} photo{doneCount > 1 ? "s" : ""} ajoutée{doneCount > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => setPhotoMode("choose")}
                    className="text-[12px] font-semibold text-form-muted underline underline-offset-2 hover:text-form-blue">
                    Changer de mode
                  </button>
                </div>

                {/* Progression des angles */}
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {Array.from({ length: totalPhotoSteps }).map((_, i) => (
                    <button key={i} type="button" onClick={() => setPhotoStep(i)}
                      aria-label={`Aller à l'angle ${i + 1}`}
                      className={`h-1.5 shrink-0 rounded-full transition-all duration-200 ${
                        i === photoStep ? "w-7 bg-form-blue" : images[i] ? "w-3.5 bg-emerald-500" : "w-3.5 bg-form-edge"
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
                    <div className="flex flex-col gap-3">
                      <PhotoTile
                        src={img}
                        ratio="wide"
                        label={guide.label}
                        hint={img ? undefined : isMain ? "Elle s'affiche en premier dans les résultats" : "Appuyez pour ajouter cet angle"}
                        icon={guide.icon}
                        badge={img && plateStatus[img] > 0 ? "Plaque floutée" : null}
                        onPick={triggerUpload}
                        onRemove={img ? () => removeImage(photoStep) : undefined}
                      />

                      {(uploading || plateDetecting) && (
                        <FormNote tone="info" icon="hourglass_top">
                          {plateDetecting ? "Analyse des plaques d'immatriculation…" : "Envoi de la photo…"}
                        </FormNote>
                      )}

                      {/* Nav buttons */}
                      <div className="flex items-center gap-2">
                        {photoStep > 0 && (
                          <button type="button" onClick={() => setPhotoStep((s) => s - 1)}
                            aria-label="Angle précédent"
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-form-line bg-white text-form-muted transition-colors hover:border-form-dash">
                            <span className="material-symbols-outlined">chevron_left</span>
                          </button>
                        )}
                        {img ? (
                          <button type="button"
                            onClick={() => !isLast && setPhotoStep((s) => s + 1)}
                            disabled={isLast}
                            className="flex-1 rounded-full bg-form-blue py-3 text-[14px] font-bold text-white shadow-[0_6px_16px_rgba(45,86,224,0.25)] transition-all active:scale-95 disabled:opacity-40 disabled:shadow-none">
                            {isLast ? "Photos complètes ✓" : "Angle suivant →"}
                          </button>
                        ) : (
                          <button type="button"
                            onClick={() => !isMain && setPhotoStep((s) => s + 1)}
                            disabled={isMain}
                            className={`flex-1 rounded-full border py-3 text-[14px] font-semibold transition-all ${
                              isMain
                                ? "cursor-default border-transparent bg-form-soft text-form-faint/70"
                                : "border-form-line bg-white text-form-muted hover:border-form-dash"
                            }`}>
                            {isMain ? "Ajoutez d'abord la photo principale" : "Passer cet angle →"}
                          </button>
                        )}
                      </div>

                      {/* Uploaded thumbnails strip */}
                      {doneCount > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 pt-1">
                          {images.map((im, i) => im ? (
                            <button key={i} type="button" onClick={() => setPhotoStep(i)}
                              aria-label={`Voir la photo ${i + 1}`}
                              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-[12px] border-2 transition-all ${
                                i === photoStep ? "border-form-blue" : "border-transparent hover:border-form-line"
                              }`}>
                              <img src={im} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-sm" />
                              <img src={im} alt="" className="relative h-full w-full object-contain" />
                              <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-form-ink/70 text-[9px] font-bold text-white">{i + 1}</span>
                            </button>
                          ) : null)}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <input ref={mainFileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden"
                  onChange={async (e) => {
                    await handleImageUpload(e.target.files, 0);
                    setPhotoStep((s) => s === 0 ? 1 : s);
                    e.target.value = "";
                  }} />
                <input ref={extraFileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple className="hidden"
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

        {/* ══ ÉTAPE TITRE ═══════════════════════════════════════════════════ */}
        {formStep === STEP.TITLE && (
          <div className="flex flex-col gap-[22px]">
            <div>
              <h2 className={stepTitleCls}>De quoi s&apos;agit-il ?</h2>
              <p className={stepSubCls}>Donnez un titre clair : c&apos;est lui qui décide de la catégorie.</p>
            </div>

            {/* Le prix a son étape à lui, après la description : pas de saisie
                ici, sinon le vendeur chiffre avant d'avoir décrit le bien. */}
            <div className="flex flex-col gap-2">
              <label className={labelCls}>Titre de l&apos;annonce</label>
              <input value={title} autoFocus
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
                placeholder="Ex : Vélo de ville en excellent état" />
            </div>

            {/* Catégorie auto-détectée */}
            {autoDetected && (() => {
              const cat = CATEGORIES.find((c) => c.id === categoryId);
              return (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Catégorie détectée</label>
                    <button type="button"
                      onClick={() => { setAutoDetected(false); setUserPickedCategory(false); setFormStep(STEP.PRICE); }}
                      className="text-[12px] font-semibold text-form-muted underline underline-offset-2 hover:text-form-blue">Modifier</button>
                  </div>
                  <div className="flex items-center gap-2 self-start rounded-full bg-form-blue/8 px-3.5 py-2 text-form-blue">
                    <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{cat?.icon}</span>
                    <span className="text-sm font-bold">{cat?.label}</span>
                    <span className="material-symbols-outlined text-sm text-emerald-500">check_circle</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className={labelCls}>Sous-catégorie</p>
                    <div className="flex flex-wrap gap-2">
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
              <div className="flex flex-col gap-3">
                <label className={labelCls}>Catégorie</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.slice(0, 6).map((cat) => (
                    <button key={cat.id} type="button"
                      onClick={() => { setCategoryId(cat.id); setSubcategory(cat.subcategories[0]); setUserPickedCategory(true); }}
                      className={`flex flex-col items-center gap-1.5 rounded-[14px] border-[1.5px] px-2 py-3 text-center transition-all ${
                        categoryId === cat.id
                          ? "border-form-blue bg-form-blue/8 text-form-blue"
                          : "border-form-line bg-form-soft text-form-muted hover:border-form-dash"
                      }`}>
                      <span className="material-symbols-outlined text-xl">{cat.icon}</span>
                      <span className="text-[11px] font-semibold leading-tight">{cat.label}</span>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setFormStep(STEP.PRICE)}
                  className="flex items-center gap-1 self-start text-[13px] font-semibold text-form-blue">
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                  Voir toutes les catégories
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ ÉTAPE PRIX + CATÉGORIE (si non détectée) ══════════════════════ */}
        {formStep === STEP.PRICE && (
          <div className="flex flex-col gap-[22px]">
            <div>
              <h2 className={stepTitleCls}>Fixez votre {fieldSpec.labels.price.toLowerCase()}</h2>
              <p className={stepSubCls}>Vous pourrez toujours l&apos;ajuster plus tard.</p>
            </div>
            <div className="flex flex-col gap-[22px]">
              {/* Prix — « Prix de vente » n'a pas de sens pour un loyer, un tarif
                  horaire ou un salaire : le libellé suit le régime. */}
              <div className="flex flex-col gap-2">
                <label className={labelCls}>{fieldSpec.labels.price}</label>
                <div className="relative">
                  <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" autoFocus
                    className={inputCls + " pr-12 text-[20px] font-bold"}
                    placeholder="0" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[20px] font-bold text-form-faint">€</span>
                </div>
              </div>

              {/* Catégorie — seulement si non détectée automatiquement */}
              {!autoDetected && (
                <div className="flex flex-col gap-3">
                  <label className={labelCls}>Catégorie</label>
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
                    {CATEGORIES.map((cat) => (
                      <button key={cat.id} type="button"
                        onClick={() => { setCategoryId(cat.id); setSubcategory(cat.subcategories[0]); setUserPickedCategory(true); }}
                        className={`flex flex-col items-center gap-1.5 rounded-[14px] border-[1.5px] px-2 py-3 transition-all ${
                          categoryId === cat.id
                            ? "border-form-blue bg-form-blue/8 text-form-blue"
                            : "border-form-line bg-form-soft text-form-muted hover:border-form-dash"
                        }`}>
                        <span className="material-symbols-outlined text-xl" style={categoryId === cat.id ? { fontVariationSettings: "'FILL' 1" } : {}}>{cat.icon}</span>
                        <span className="text-center text-[11px] font-semibold leading-tight">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <p className={labelCls}>Sous-catégorie</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.find((c) => c.id === categoryId)?.subcategories.map((sub) => (
                    <button key={sub} type="button" onClick={() => setSubcategory(sub)} className={pillCls(subcategory === sub)}>{sub}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Le moteur annonce ce qu'il a compris plutôt que de changer le
                formulaire en silence. Sous 0,6 de confiance il se tait : mieux
                vaut ne rien dire que d'affirmer à tort. */}
            {!regimeOverride && intent.confidence >= 0.6 && intent.nature !== "bien" && (
              <div className="flex items-start gap-2.5 bg-primary-light/60 border border-primary/20 rounded-2xl px-4 py-3">
                <span className="material-symbols-outlined text-primary text-lg shrink-0">auto_awesome</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-primary">
                    Annonce reconnue comme «&nbsp;{fieldSpec.label.toLowerCase()}&nbsp;»
                  </p>
                  <p className="text-[11px] text-outline leading-snug mt-0.5">
                    {intent.signals.slice(0, 2).join(" · ")} — les champs sont adaptés.
                  </p>
                </div>
                <button type="button" onClick={() => setRegimeOverride("bien")}
                  className="text-[11px] font-bold text-primary shrink-0 underline">
                  Ce n&apos;est pas ça
                </button>
              </div>
            )}

            {/* Détails de prestation — ce que le texte libre ne dit jamais de
                façon fiable : ce que le prix couvre, pour combien de temps et
                où. Affichés dès que l'intention est « prestation », quelle que
                soit la rubrique : un dépannage publié dans « Divers » a les
                mêmes questions à répondre qu'un massage. */}
            {fieldSpec.core.serviceDetails && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-6">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Détails de la prestation</p>

                <div className="space-y-2">
                  <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Durée</label>
                  <div className="flex flex-wrap gap-2">
                    {WELLNESS_DURATIONS.map((d) => (
                      <button key={d.value} type="button" onClick={() => setW("durationMin", wellness.durationMin === d.value ? "" : d.value)} className={pillCls(wellness.durationMin === d.value)}>{d.label}</button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Le prix correspond à</label>
                    <select value={wellness.priceUnit} onChange={(e) => setW("priceUnit", e.target.value)} className={inputCls}>
                      <option value="">Non précisé</option>
                      {WELLNESS_PRICE_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Type de tarif</label>
                    <select value={wellness.tariffType} onChange={(e) => setW("tariffType", e.target.value)} className={inputCls}>
                      {WELLNESS_TARIFF_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Lieu de la prestation</label>
                  <div className="flex flex-wrap gap-2">
                    {WELLNESS_PLACES.map((pl) => (
                      <button key={pl} type="button" onClick={() => setW("place", wellness.place === pl ? "" : pl)} className={pillCls(wellness.place === pl)}>{pl}</button>
                    ))}
                  </div>
                </div>

                {/* La carte complète des prestations vit sur la fiche
                    professionnelle (/profile/espace-pro), pas dans une annonce :
                    un salon ne doit pas publier une annonce par prestation. */}
                {fieldSpec.core.serviceCard && (
                  <p className="text-xs text-outline leading-relaxed bg-surface-container-low rounded-xl px-3 py-2.5">
                    Une annonce = une prestation. Vous en proposez plusieurs&nbsp;?{" "}
                    <a href="/profile" className="font-bold text-primary hover:underline">
                      Passez en compte professionnel
                    </a>{" "}
                    et présentez votre carte complète sur une seule fiche.
                  </p>
                )}

              </div>
            )}

            {/* Champs propres au régime, déclarés en données dans
                lib/offer-fields.ts — caution d'une location, type de contrat
                d'une offre d'emploi. Rendus génériquement pour qu'un ajout ne
                demande aucune modification d'écran, ici comme sur mobile. */}
            {fieldSpec.extra.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                  {fieldSpec.label}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {fieldSpec.extra.map((f) => (
                    <div key={f.id} className="space-y-2">
                      <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">
                        {f.label}{f.required && " *"}
                      </label>
                      {f.type === "select" ? (
                        <select value={extraFields[f.id] ?? ""} onChange={(e) => setExtra(f.id, e.target.value)} className={inputCls}>
                          <option value="">Non précisé</option>
                          {f.options?.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={f.type === "number" ? "number" : "text"}
                          inputMode={f.type === "number" ? "decimal" : undefined}
                          value={extraFields[f.id] ?? ""}
                          onChange={(e) => setExtra(f.id, e.target.value)}
                          placeholder={f.placeholder}
                          className={inputCls}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Champs immobilier */}
            {categoryId === "immobilier" && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-6">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Caractéristiques du bien</p>

                {/* Type de bien */}
                <div className="space-y-2">
                  <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Type de bien</label>
                  <div className="flex flex-wrap gap-2">
                    {["Appartement", "Maison", "Studio", "Villa", "Terrain", "Local commercial", "Autre"].map((t) => (
                      <button key={t} type="button" onClick={() => setI("typeBien", t)} className={pillCls(immo.typeBien === t) + " whitespace-nowrap"}>{t}</button>
                    ))}
                  </div>
                </div>

                {/* Surface + Pièces */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Surface habitable</label>
                    <div className="relative">
                      <input value={immo.surface} onChange={(e) => setI("surface", e.target.value)} className={inputCls + " pr-10"} placeholder="65" type="number" min="1" />
                      <span className="absolute right-3 top-3 text-xs text-outline">m²</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Nombre de pièces</label>
                    <div className="flex gap-2 flex-wrap">
                      {["1", "2", "3", "4", "5", "6+"].map((n) => (
                        <button key={n} type="button" onClick={() => setI("nombrePieces", n)}
                          className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${immo.nombrePieces === n ? "bg-primary text-white border-primary shadow-md" : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Chambres + Salles d'eau */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Chambres</label>
                    <div className="flex gap-2 flex-wrap">
                      {["0", "1", "2", "3", "4", "5+"].map((n) => (
                        <button key={n} type="button" onClick={() => setI("nombreChambres", n)}
                          className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${immo.nombreChambres === n ? "bg-primary text-white border-primary shadow-md" : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Salles d&apos;eau</label>
                    <div className="flex gap-2 flex-wrap">
                      {["0", "1", "2", "3", "4+"].map((n) => (
                        <button key={n} type="button" onClick={() => setI("nombreSallesEau", n)}
                          className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${immo.nombreSallesEau === n ? "bg-primary text-white border-primary shadow-md" : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Étage */}
                <div className="space-y-2">
                  <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Étage</label>
                  <div className="flex gap-2 flex-wrap">
                    {["RDC", "1", "2", "3", "4", "5+"].map((n) => (
                      <button key={n} type="button" onClick={() => setI("etage", n)}
                        className={`min-w-[48px] px-4 py-2.5 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all whitespace-nowrap ${immo.etage === n ? "bg-primary text-white border-primary shadow-md" : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"}`}>{n}</button>
                    ))}
                  </div>
                </div>

                {/* Exposition */}
                <div className="space-y-2">
                  <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Exposition</label>
                  <div className="flex gap-2 flex-wrap">
                    {["Nord", "Sud", "Est", "Ouest", "Sud-Est", "Sud-Ouest"].map((e) => (
                      <button key={e} type="button" onClick={() => setI("exposition", e)}
                        className={pillCls(immo.exposition === e) + " whitespace-nowrap"}>{e}</button>
                    ))}
                  </div>
                </div>

                {/* Chauffage */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Type de chauffage</label>
                    <div className="flex gap-2 flex-wrap">
                      {["Individuel", "Collectif"].map((t) => (
                        <button key={t} type="button" onClick={() => setI("typeCharuffe", t)}
                          className={pillCls(immo.typeCharuffe === t) + " whitespace-nowrap"}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Mode de chauffage</label>
                    <div className="flex gap-2 flex-wrap">
                      {["Gaz", "Électrique", "Fuel", "PAC", "Poêle", "Autre"].map((m) => (
                        <button key={m} type="button" onClick={() => setI("modeCharuffe", m)}
                          className={pillCls(immo.modeCharuffe === m) + " whitespace-nowrap"}>{m}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Parking + Année */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Places de parking</label>
                    <div className="flex gap-2 flex-wrap">
                      {["0", "1", "2", "3+"].map((n) => (
                        <button key={n} type="button" onClick={() => setI("placesParking", n)}
                          className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${immo.placesParking === n ? "bg-primary text-white border-primary shadow-md" : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Année de construction</label>
                    <input value={immo.anneeConstruction} onChange={(e) => setI("anneeConstruction", e.target.value)} className={inputCls} placeholder="ex : 1985" type="number" min="1800" max={new Date().getFullYear()} />
                  </div>
                </div>

                {/* Référence */}
                <div className="space-y-2">
                  <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Référence interne (optionnel)</label>
                  <input value={immo.reference} onChange={(e) => setI("reference", e.target.value)} className={inputCls} placeholder="ex : AZ/2888" />
                </div>

                {/* État du bien */}
                <div className="space-y-2">
                  <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">État du bien</label>
                  <div className="flex flex-wrap gap-2">
                    {["Neuf", "Parfait état", "Bon état", "À rénover", "Travaux à prévoir"].map((e) => (
                      <button key={e} type="button" onClick={() => setI("etatBien", e)}
                        className={pillCls(immo.etatBien === e) + " whitespace-nowrap"}>{e}</button>
                    ))}
                  </div>
                </div>

                {/* Équipements */}
                <div className="space-y-2">
                  <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Équipements & caractéristiques</label>
                  <div className="flex flex-wrap gap-2">
                    {["Garage", "Parking", "Cave", "Piscine", "Jardin", "Balcon", "Terrasse", "Ascenseur", "Digicode", "Interphone", "Gardien", "Meublé", "Double vitrage", "Fibre optique", "Cheminée", "Véranda", "Dressing"].map((c) => (
                      <button key={c} type="button" onClick={() => toggleCarac(c)}
                        className={pillCls(immo.caracteristiques.includes(c)) + " whitespace-nowrap"}>{c}</button>
                    ))}
                  </div>
                </div>

                {/* DPE + GES */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Classe énergie (DPE)</label>
                    <div className="flex gap-1.5">
                      {(["A", "B", "C", "D", "E", "F", "G"] as const).map((l) => {
                        const colors: Record<string, string> = { A: "#009966", B: "#33cc33", C: "#99cc00", D: "#ffcc00", E: "#ff9900", F: "#ff6600", G: "#ff0000" };
                        const active = immo.classeEnergie === l;
                        return (
                          <button key={l} type="button" onClick={() => setI("classeEnergie", l)}
                            className="flex-1 h-11 rounded-xl flex items-center justify-center text-sm font-black transition-all border-2"
                            style={{ background: active ? colors[l] : "#f1f5f9", color: active ? "#fff" : "#94a3b8", borderColor: active ? colors[l] : "transparent" }}>
                            {l}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">GES</label>
                    <div className="flex gap-1.5">
                      {(["A", "B", "C", "D", "E", "F", "G"] as const).map((l) => {
                        const colors: Record<string, string> = { A: "#e8d5f5", B: "#d4aae8", C: "#c07fda", D: "#a855c9", E: "#8e2db7", F: "#7209a1", G: "#5c008a" };
                        const active = immo.ges === l;
                        return (
                          <button key={l} type="button" onClick={() => setI("ges", l)}
                            className="flex-1 h-11 rounded-xl flex items-center justify-center text-sm font-black transition-all border-2"
                            style={{ background: active ? colors[l] : "#f1f5f9", color: active ? (["A","B"].includes(l) ? "#7209a1" : "#fff") : "#94a3b8", borderColor: active ? colors[l] : "transparent" }}>
                            {l}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Vue & vis-à-vis */}
                <div className="space-y-2">
                  <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Honoraires & taxes</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Prix honoraires TTC inclus (€)</label>
                      <input value={immo.prixHonorairesInclus} onChange={(e) => setI("prixHonorairesInclus", e.target.value)} className={inputCls} placeholder="ex : 220 000" type="number" min="0" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Prix honoraires TTC exclus (€)</label>
                      <input value={immo.prixHonorairesExclus} onChange={(e) => setI("prixHonorairesExclus", e.target.value)} className={inputCls} placeholder="ex : 210 000" type="number" min="0" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Honoraires TTC acquéreur (€)</label>
                      <input value={immo.honorairesAcquereur} onChange={(e) => setI("honorairesAcquereur", e.target.value)} className={inputCls} placeholder="ex : 10 000" type="number" min="0" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Taxe foncière annuelle (€)</label>
                      <input value={immo.taxeFonciere} onChange={(e) => setI("taxeFonciere", e.target.value)} className={inputCls} placeholder="ex : 1 200" type="number" min="0" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Vue & environnement</label>
                  <div className="flex flex-col gap-1">
                    <ToggleField
                      checked={immo.vueMer}
                      onChange={(next) => setI("vueMer", next)}
                      icon="water"
                      label="Vue sur mer"
                      className="py-1.5"
                    />
                    <ToggleField
                      checked={!immo.visAVis}
                      onChange={(next) => setI("visAVis", !next)}
                      tone="emerald"
                      icon="visibility_off"
                      label={
                        <span className="flex items-center gap-2">
                          {immo.visAVis ? "Vis-à-vis présent" : "Pas de vis-à-vis"}
                          {!immo.visAVis && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                              Atout
                            </span>
                          )}
                        </span>
                      }
                      className="py-1.5"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Champs véhicules */}
            {categoryId === "vehicules" && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Fiche technique</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Marque */}
                  <div className="col-span-2"><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Marque</label>
                    <BrandPicker value={vehicle.marque} onChange={(v) => setV("marque", v)} inputCls={inputCls} /></div>
                  {/* Modèle */}
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Modèle</label>
                    <input value={vehicle.modele} onChange={(e) => setV("modele", e.target.value)} className={inputCls} placeholder="Série 6, Clio…" /></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Nom complet du modèle</label>
                    <input value={vehicle.nomModele} onChange={(e) => setV("nomModele", e.target.value)} className={inputCls} placeholder="SERIE 6 COUPE" /></div>
                  {/* Motorisation */}
                  <div className="col-span-2"><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Motorisation</label>
                    <input value={vehicle.motorisation} onChange={(e) => setV("motorisation", e.target.value)} className={inputCls} placeholder="640d xDrive Coupé 313ch" /></div>
                  {/* Année + Km */}
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Année</label>
                    <input value={vehicle.annee} onChange={(e) => setV("annee", e.target.value)} className={inputCls} placeholder="2021" type="number" /></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Kilométrage</label>
                    <div className="relative"><input value={vehicle.kilometrage} onChange={(e) => setV("kilometrage", e.target.value)} className={inputCls + " pr-10"} placeholder="45 000" type="number" /><span className="absolute right-3 top-3 text-xs text-outline">km</span></div></div>
                  {/* Type véhicule */}
                  <div className="col-span-2"><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Type de véhicule</label>
                    <div className="flex flex-wrap gap-1.5">{VEHICLE_TYPES.map((t) => <button key={t} type="button" onClick={() => setV("typeVehicule", t)} className={pillCls(vehicle.typeVehicule === t) + " whitespace-nowrap"}>{t}</button>)}</div></div>
                  {/* Carburant */}
                  <div className="col-span-2"><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Énergie</label>
                    <div className="flex flex-wrap gap-1.5">{FUELS.map((f) => <button key={f} type="button" onClick={() => setV("carburant", f)} className={pillCls(vehicle.carburant === f)}>{f}</button>)}</div></div>
                  {/* Transmission + Vitesses */}
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Boîte</label>
                    <div className="flex gap-2">{TRANSMISSIONS.map((t) => <button key={t} type="button" onClick={() => setV("transmission", t)} className={pillCls(vehicle.transmission === t) + " flex-1"}>{t}</button>)}</div></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Nbr de vitesses</label>
                    <input value={vehicle.nombreVitesses} onChange={(e) => setV("nombreVitesses", e.target.value)} className={inputCls} placeholder="6" type="number" /></div>
                  {/* Portes + Places */}
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Portes</label>
                    <div className="flex gap-1.5">{["2","3","4","5"].map((n) => <button key={n} type="button" onClick={() => setV("nombrePortes", n)} className={pillCls(vehicle.nombrePortes === n) + " flex-1"}>{n}</button>)}</div></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Nbr de places</label>
                    <input value={vehicle.nombrePlaces} onChange={(e) => setV("nombrePlaces", e.target.value)} className={inputCls} placeholder="5" type="number" /></div>
                  {/* Couleur + Puissance */}
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Couleur</label>
                    <input value={vehicle.couleur} onChange={(e) => setV("couleur", e.target.value)} className={inputCls} placeholder="Noir, Blanc…" /></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Puissance fiscale</label>
                    <div className="relative"><input value={vehicle.puissanceFiscale} onChange={(e) => setV("puissanceFiscale", e.target.value)} className={inputCls + " pr-8"} placeholder="7" type="number" /><span className="absolute right-3 top-3 text-xs text-outline">CV</span></div></div>
                  {/* Immat + Date immat */}
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Immatriculation</label>
                    <input value={vehicle.immatriculation} onChange={(e) => setV("immatriculation", e.target.value.toUpperCase())} className={inputCls + " font-mono tracking-widest"} placeholder="AB-123-CD" maxLength={10} /></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Date d&apos;immatriculation</label>
                    <input value={vehicle.dateImmatriculation} onChange={(e) => setV("dateImmatriculation", e.target.value)} className={inputCls} type="date" /></div>
                  {/* Consommations */}
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Conso. urbaine</label>
                    <div className="relative"><input value={vehicle.consoUrbaine} onChange={(e) => setV("consoUrbaine", e.target.value)} className={inputCls + " pr-16"} placeholder="7.1" type="number" step="0.1" /><span className="absolute right-3 top-3 text-xs text-outline">L/100km</span></div></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Conso. extra-urbaine</label>
                    <div className="relative"><input value={vehicle.consoExtraUrbaine} onChange={(e) => setV("consoExtraUrbaine", e.target.value)} className={inputCls + " pr-16"} placeholder="5.1" type="number" step="0.1" /><span className="absolute right-3 top-3 text-xs text-outline">L/100km</span></div></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Conso. mixte</label>
                    <div className="relative"><input value={vehicle.consoMixte} onChange={(e) => setV("consoMixte", e.target.value)} className={inputCls + " pr-16"} placeholder="5.8" type="number" step="0.1" /><span className="absolute right-3 top-3 text-xs text-outline">L/100km</span></div></div>
                  <div><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Émission CO₂</label>
                    <div className="relative"><input value={vehicle.emissionCO2} onChange={(e) => setV("emissionCO2", e.target.value)} className={inputCls + " pr-12"} placeholder="153" type="number" /><span className="absolute right-3 top-3 text-xs text-outline">g/km</span></div></div>
                  {/* Crit'Air */}
                  <div className="col-span-2"><label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Crit&apos;Air</label>
                    <div className="flex gap-2 flex-wrap">{CRITAIR.map((c) => <button key={c} type="button" onClick={() => setV("critAir", c)} className={pillCls(vehicle.critAir === c)}>{c === "0" ? "⚡ 0" : c}</button>)}</div></div>
                </div>
                {/* Équipements */}
                <div className="space-y-2">
                  <label className="text-[10px] text-outline uppercase font-bold tracking-wider block">Équipements & options</label>
                  <div className="flex flex-wrap gap-1.5">
                    {VEHICLE_EQUIPMENTS.map((eq) => (
                      <button key={eq} type="button" onClick={() => toggleEquip(eq)}
                        className={pillCls(vehicle.equipements.includes(eq)) + " whitespace-nowrap text-xs"}>
                        {eq}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ ÉTAPE DESCRIPTION & ÉTAT ══════════════════════════════════════ */}
        {formStep === STEP.DESC && (
          <div className="flex flex-col gap-[22px]">
            <div>
              <h2 className={stepTitleCls}>{fieldSpec.labels.descriptionStep}</h2>
              <p className={stepSubCls}>Plus c&apos;est précis, plus vite ça se vend.</p>
            </div>

            {/* AI assist button */}
            <button
              type="button"
              onClick={handleAiAssist}
              disabled={aiLoading || !title}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-bold text-sm shadow-[0_4px_16px_rgba(109,40,217,0.25)] active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {aiLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-[2.5px] border-white border-t-transparent" />
                  Génération en cours…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  Générer la description avec l&apos;IA
                </>
              )}
            </button>
            {aiError && <p className="text-red-500 text-xs text-center font-medium">{aiError}</p>}

            <div className="flex flex-col gap-[22px]">
              {/* L'état ne se demande que d'un objet. Une prestation, un poste
                  ou un événement n'en ont pas — la question était absurde et la
                  réponse partait quand même en base. */}
              {fieldSpec.core.condition && (
                <div className="flex flex-col gap-2">
                  <label className={labelCls}>État du produit</label>
                  <div className="flex flex-wrap gap-2">
                    {CONDITIONS.map((c) => <button key={c} type="button" onClick={() => setCondition(c)} className={pillCls(condition === c)}>{c}</button>)}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className={labelCls}>Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={7} autoFocus
                  className={inputCls + " resize-y leading-relaxed"}
                  placeholder={DESCRIPTION_PLACEHOLDERS[fieldSpec.lexicon]} />

                {/*
                  Compteur de visibilité.
                  Il affichait « 157 caractères », une information sans enjeu :
                  le vendeur n'avait aucun moyen de savoir que le seuil était à
                  250, ni ce qu'il perdait à s'arrêter avant. La médiane des
                  descriptions trop courtes est justement à 157.
                */}
                <div className="space-y-1.5">
                  <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        description.trim().length >= seoBar.minDescription ? "bg-emerald-500" : "bg-primary"
                      }`}
                      style={{
                        width: `${Math.min(100, (description.trim().length / seoBar.minDescription) * 100)}%`,
                      }}
                    />
                  </div>
                  {description.trim().length >= seoBar.minDescription ? (
                    <p className="text-xs text-emerald-600 font-semibold text-right tabular-nums">
                      {description.trim().length} caractères — référencée sur Google
                    </p>
                  ) : (
                    <p className="text-xs text-outline text-right tabular-nums">
                      {description.trim().length} caractères — encore{" "}
                      <strong className="text-on-surface">
                        {seoBar.minDescription - description.trim().length}
                      </strong>{" "}
                      pour apparaître sur Google
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ ÉTAPE RÉCAPITULATIF ═══════════════════════════════════════════ */}
        {formStep === STEP.RECAP && (() => {
          const cat = CATEGORIES.find((c) => c.id === categoryId);
          return (
            <div className="flex flex-col gap-[22px]">
              <div>
                <h2 className={stepTitleCls}>Récapitulatif</h2>
                <p className={stepSubCls}>Vérifiez avant de publier — « Modifier » vous ramène à l&apos;étape concernée.</p>
              </div>

              {/*
                Dernier rattrapage avant publication.
                Ce n'est pas un blocage : l'annonce se publie telle quelle, elle
                est visible sur le site, et c'est le vendeur qui décide. Mais il
                décide en sachant — ce qui n'était pas le cas jusqu'ici. Sur les
                174 annonces écartées de l'index, 31 le sont pour un seul geste
                manquant, que ce panneau nomme.
              */}
              {(() => {
                const missing: string[] = [];
                const photos = images.filter(Boolean).length;
                const chars = description.trim().length;
                if (photos < seoBar.minImages) {
                  const n = seoBar.minImages - photos;
                  missing.push(`${n} photo${n > 1 ? "s" : ""}`);
                }
                if (chars < seoBar.minDescription) {
                  missing.push(`${seoBar.minDescription - chars} caractères de description`);
                }
                if (missing.length === 0) {
                  return (
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
                      <span className="material-symbols-outlined text-emerald-600 text-xl shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                        travel_explore
                      </span>
                      <p className="text-sm text-emerald-800 font-medium leading-snug">
                        Votre annonce sera référencée sur Google.
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
                    <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
                      travel_explore
                    </span>
                    <div className="text-sm text-on-surface font-medium leading-snug">
                      Il manque <strong>{missing.join(" et ")}</strong> pour que votre
                      annonce apparaisse sur Google.
                      <span className="block text-outline font-normal mt-0.5">
                        Vous pouvez publier maintenant : l&apos;annonce sera visible sur
                        Deal&amp;Co, et elle sera référencée automatiquement dès que vous
                        la compléterez.
                      </span>
                      <div className="flex gap-3 mt-2">
                        {photos < seoBar.minImages && (
                          <button type="button" onClick={() => setFormStep(STEP.PHOTOS)} className="text-xs font-bold text-primary underline underline-offset-2">
                            Ajouter des photos
                          </button>
                        )}
                        {chars < seoBar.minDescription && (
                          <button type="button" onClick={() => setFormStep(STEP.DESC)} className="text-xs font-bold text-primary underline underline-offset-2">
                            Compléter la description
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Photos */}
              <div className="rounded-[14px] border border-form-line bg-form-soft overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Photos</span>
                  <button type="button" onClick={() => setFormStep(STEP.PHOTOS)}
                    className="flex items-center gap-1 text-xs font-bold text-primary">
                    <span className="material-symbols-outlined text-sm">edit</span>Modifier
                  </button>
                </div>
                {images.filter(Boolean).length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto p-4">
                    {images.filter(Boolean).map((img, i) => (
                      <div key={i} className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-slate-100">
                        <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover blur-sm scale-110 opacity-50" />
                        <img src={img} alt={`Photo ${i + 1}`} className="relative w-full h-full object-contain" />
                        {i === 0 && <span className="absolute bottom-0 left-0 right-0 text-center text-[8px] font-bold bg-primary text-white py-0.5">Principale</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-5 py-4 text-sm text-outline italic">Aucune photo — l&apos;annonce sera moins visible</p>
                )}
              </div>

              {/* Titre + Prix */}
              <div className="rounded-[14px] border border-form-line bg-form-soft overflow-hidden divide-y divide-form-line">
                <div className="flex items-start justify-between px-5 py-4">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Titre</p>
                    <p className="font-bold text-on-surface text-base leading-snug">{title || <span className="text-outline italic">Non renseigné</span>}</p>
                  </div>
                  <button type="button" onClick={() => setFormStep(STEP.TITLE)}
                    className="flex items-center gap-1 text-xs font-bold text-primary shrink-0">
                    <span className="material-symbols-outlined text-sm">edit</span>Modifier
                  </button>
                </div>
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Prix</p>
                    <p className="text-2xl font-extrabold text-on-surface">{price ? `${price} €` : <span className="text-outline italic text-base">Non renseigné</span>}</p>
                  </div>
                  <button type="button" onClick={() => setFormStep(STEP.PRICE)}
                    className="flex items-center gap-1 text-xs font-bold text-primary shrink-0">
                    <span className="material-symbols-outlined text-sm">edit</span>Modifier
                  </button>
                </div>
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Catégorie</p>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-primary">{cat?.icon}</span>
                      <p className="font-semibold text-sm text-on-surface">{cat?.label}{subcategory ? ` › ${subcategory}` : ""}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setFormStep(STEP.PRICE)}
                    className="flex items-center gap-1 text-xs font-bold text-primary shrink-0">
                    <span className="material-symbols-outlined text-sm">edit</span>Modifier
                  </button>
                </div>
              </div>

              {/* État + Description */}
              <div className="rounded-[14px] border border-form-line bg-form-soft overflow-hidden divide-y divide-form-line">
                {fieldSpec.core.condition && (
                  <div className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">État</p>
                      <p className="font-semibold text-sm text-on-surface">{condition}</p>
                    </div>
                    <button type="button" onClick={() => setFormStep(STEP.DESC)}
                      className="flex items-center gap-1 text-xs font-bold text-primary shrink-0">
                      <span className="material-symbols-outlined text-sm">edit</span>Modifier
                    </button>
                  </div>
                )}
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Description</p>
                    <button type="button" onClick={() => setFormStep(STEP.DESC)}
                      className="flex items-center gap-1 text-xs font-bold text-primary shrink-0 ml-3">
                      <span className="material-symbols-outlined text-sm">edit</span>Modifier
                    </button>
                  </div>
                  {description ? (
                    <p className="text-sm text-on-surface leading-relaxed whitespace-pre-line line-clamp-5">{description}</p>
                  ) : (
                    <p className="text-sm text-outline italic">Non renseignée</p>
                  )}
                </div>
              </div>

              {/* Localisation + Téléphone */}
              <div className="rounded-[14px] border border-form-line bg-form-soft overflow-hidden divide-y divide-form-line">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">location_on</span>
                    <p className="font-semibold text-sm text-on-surface">{location || <span className="text-outline italic font-normal">Non renseignée</span>}</p>
                  </div>
                  <button type="button" onClick={() => setFormStep(STEP.CONTACT)}
                    className="flex items-center gap-1 text-xs font-bold text-primary shrink-0">
                    <span className="material-symbols-outlined text-sm">edit</span>Modifier
                  </button>
                </div>
                {phone && (
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-outline text-xl">call</span>
                      <p className="font-semibold text-sm text-on-surface">{phone}{hidePhone && <span className="ml-2 text-[10px] text-outline font-normal">(masqué)</span>}</p>
                    </div>
                    <button type="button" onClick={() => setFormStep(STEP.CONTACT)}
                      className="flex items-center gap-1 text-xs font-bold text-primary shrink-0">
                      <span className="material-symbols-outlined text-sm">edit</span>Modifier
                    </button>
                  </div>
                )}
              </div>

              {publishError && <p className="text-red-500 text-sm font-medium text-center">{publishError}</p>}

              <p className="text-xs text-outline text-center leading-relaxed">
                En publiant, vous acceptez nos{" "}
                <a href="#" className="underline font-bold text-primary">Conditions d&apos;utilisation</a> et{" "}
                <a href="#" className="underline font-bold text-primary">Règles de publication</a>.
              </p>
            </div>
          );
        })()}

        {/* ══ ÉTAPE COORDONNÉES ═════════════════════════════════════════════ */}
        {formStep === STEP.CONTACT && (
          <div className="flex flex-col gap-[22px]">
            <div>
              <h2 className={stepTitleCls}>Où et comment vous joindre ?</h2>
              <p className={stepSubCls}>Ces informations restent visibles sur l&apos;annonce publiée.</p>
            </div>

            {/* Casquette de publication — posée uniquement aux comptes qui ont
                réellement les deux usages (particulier devenu professionnel). */}
            {postingCaps?.mustChoose && (
              <div className="rounded-[14px] border border-form-line bg-form-soft p-5 space-y-3">
                <p className={labelCls}>Vous publiez cette annonce en tant que</p>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      {
                        value: "PARTICULIER" as const,
                        icon: "person",
                        title: "Particulier",
                        hint: "Vente personnelle · localisation seule",
                      },
                      {
                        value: "PRO" as const,
                        icon: "storefront",
                        title: postingCaps.companyName ?? "Professionnel",
                        hint: "Activité pro · adresse complète",
                      },
                    ]
                  ).map((opt) => {
                    const on = postedAs === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPostedAs(opt.value)}
                        className={`rounded-[14px] border-[1.5px] p-3 text-left transition-all ${
                          on
                            ? "border-form-blue bg-form-blue/8"
                            : "border-form-line bg-white hover:border-form-dash"
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-xl ${on ? "text-form-blue" : "text-form-faint"}`}
                        >
                          {opt.icon}
                        </span>
                        <p className="font-bold text-sm text-on-surface mt-1 truncate">{opt.title}</p>
                        <p className="text-[11px] text-outline leading-snug mt-0.5">{opt.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-[22px]">
              {/* Localisation */}
              <div className="flex flex-col gap-2">
                <label className={labelCls}>
                  {postedAs === "PRO" ? "Adresse de l'établissement" : "Localisation"}
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-form-blue">location_on</span>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} autoFocus
                    className={inputCls + " pl-12"}
                    placeholder={postedAs === "PRO" ? "12 rue de Turbigo, 75003 Paris" : "Ville, département"} />
                </div>
                <p className="text-[12px] leading-snug text-form-muted">
                  {postedAs === "PRO"
                    ? "L'adresse complète de votre établissement est affichée sur l'annonce : les acheteurs peuvent venir sur place."
                    : "Indiquez une ville ou un arrondissement, pas une adresse. Votre domicile n'est jamais affiché — si vous saisissez une rue, elle sera retirée."}
                </p>
              </div>
              {/* Téléphone */}
              <div className="flex flex-col gap-2">
                <label className={labelCls}>
                  Téléphone <span className="font-normal text-form-muted">(facultatif)</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-form-faint">call</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" maxLength={20}
                    className={inputCls + " pl-12"}
                    placeholder="06 12 34 56 78" />
                </div>
                {phone.trim() && (
                  <>
                    <ToggleField
                      checked={hidePhone}
                      onChange={setHidePhone}
                      icon="visibility_off"
                      label="Masquer mon numéro"
                      description={hidePhone ? "Messagerie uniquement" : "Numéro visible sur l'annonce"}
                      className="pt-2"
                    />
                    {/* Sans cette question, le bouton WhatsApp s'affichait sur
                        tous les numéros : l'acheteur tombait sur une impasse,
                        et c'est le vendeur qui semblait injoignable. */}
                    <ToggleField
                      checked={phoneOnWhatsapp}
                      onChange={setPhoneOnWhatsapp}
                      icon="chat"
                      label="Ce numéro est sur WhatsApp"
                      description={
                        phoneOnWhatsapp
                          ? "Un bouton WhatsApp sera proposé aux acheteurs"
                          : "Aucun bouton WhatsApp ne sera affiché"
                      }
                    />
                  </>
                )}
              </div>
            </div>

          </div>
        )}

        </div>

        {/* ── Navigation ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          {formStep > STEP.TITLE ? (
            <button type="button" onClick={() => setFormStep((s) => (s - 1) as FormStep)}
              className="rounded-[12px] border border-form-line bg-white px-6 py-3.5 text-[15px] font-semibold text-form-muted transition-colors hover:border-form-dash hover:text-form-ink">
              ← Précédent
            </button>
          ) : <span />}

          {formStep < STEP.RECAP ? (
            <button type="button"
              onClick={() => {
                if (!canAdvance(formStep)) return;
                setFormStep((s) => (s + 1) as FormStep);
              }}
              disabled={!canAdvance(formStep)}
              className="rounded-[12px] bg-form-blue px-7 py-3.5 text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(45,86,224,0.3)] transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">
              {formStep === STEP.CONTACT
                ? "Vérifier l'annonce →"
                : formStep === STEP.PHOTOS && photoMode === "choose"
                  ? "Passer les photos →"
                  : "Continuer →"}
            </button>
          ) : (
            <button type="button" onClick={handlePublish}
              disabled={publishing || !title || !price || !description || !location}
              className="rounded-[12px] bg-form-blue px-7 py-3.5 text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(45,86,224,0.3)] transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none">
              {publishing ? "Publication…" : "Publier l'annonce"}
            </button>
          )}
        </div>

      </main>

      {/* ── Auth gate overlay — shown when user hits publish without session ── */}
      {showAuthGate && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-extrabold text-on-surface">Connectez-vous pour publier</h2>
              <p className="text-sm text-outline">Votre annonce est prête — connectez-vous pour la mettre en ligne.</p>
            </div>
            <form onSubmit={handleGateLogin} className="space-y-3">
              <input
                type="email"
                value={gateEmail}
                onChange={(e) => setGateEmail(e.target.value)}
                placeholder="Adresse email"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <input
                type="password"
                value={gatePassword}
                onChange={(e) => setGatePassword(e.target.value)}
                placeholder="Mot de passe"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              {gateError && <p className="text-red-600 text-xs font-semibold">{gateError}</p>}
              <button
                type="submit"
                disabled={gateLoading}
                className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm disabled:opacity-50 transition-opacity"
              >
                {gateLoading ? "Connexion…" : "Se connecter et publier"}
              </button>
            </form>
            <div className="text-center space-y-2">
              <Link
                href={`/register?callbackUrl=${encodeURIComponent("/post")}`}
                className="block text-sm font-bold text-primary hover:underline"
              >
                Pas encore de compte ? Créer gratuitement →
              </Link>
              <button
                type="button"
                onClick={() => setShowAuthGate(false)}
                className="text-xs text-outline hover:underline"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

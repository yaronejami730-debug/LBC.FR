import { CATEGORIES, getCategoryByLabel } from "@/lib/categories";

export type ModerationVerdict = "approve" | "review" | "reject";
export type ModerationSeverity = "critical" | "major" | "minor";

export type ModerationFlag = {
  code: string;
  severity: ModerationSeverity;
  message: string;
};

export type ModerationInput = {
  title: string;
  description: string;
  price: number;
  category: string;
  subcategory?: string | null;
  location: string;
  condition?: string;
  images: string[];
  metadata?: Record<string, any>;
  vehicleKm?: number | null;
  vehicleYear?: number | null;
  immoSurface?: number | null;
  immoRooms?: number | null;
  userContext?: {
    accountAgeHours: number;
    recentListingsCount24h: number;
    isPro?: boolean;
  };
};

export type ModerationResult = {
  verdict: ModerationVerdict;
  score: number;
  flags: ModerationFlag[];
  publicReason: string | null;
  adminNote: string;
};

const FORBIDDEN_WORDS = [
  "cocaine", "cocaïne", "heroine", "héroïne", "crack", "mdma", "ecstasy",
  "weed", "cannabis à vendre", "résine de cannabis", "haschich",
  "kalachnikov", "kalash", "ak47", "ak-47", "glock", "beretta", "munitions 9mm",
  "arme de poing", "pistolet sans licence",
  "contrefaçon", "contrefacon", "copie parfaite", "replique parfaite", "fausse carte",
  "papier identité faux", "permis de conduire faux",
  "escort", "escorte tarifée", "sexe tarifé", "prostitution",
  "viagra sans ordonnance",
  "crypto-monnaie investissement garanti", "doublage d'argent",
];

const PHONE_REGEX = /(?:(?:\+33|0033|0)\s*[1-9](?:[\s.\-]*\d{2}){4})|(?:\b\d{10}\b)/;
const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const URL_REGEX = /\b(?:https?:\/\/|www\.)[^\s]+/i;
const EXCESSIVE_REPEAT = /(.)\1{5,}/;
const EXCESSIVE_EXCLAIM = /[!?]{4,}/;

type PriceBounds = { min: number; max: number };

const PRICE_BOUNDS: Record<string, PriceBounds> = {
  "Immobilier": { min: 10, max: 30_000_000 },
  "Véhicules": { min: 1, max: 5_000_000 },
  "Maison": { min: 1, max: 50_000 },
  "Multimédia": { min: 1, max: 20_000 },
  "Mode": { min: 1, max: 100_000 },
  "Loisirs": { min: 1, max: 30_000 },
  "Animaux": { min: 0, max: 20_000 },
  "Services": { min: 0, max: 50_000 },
  "Emploi": { min: 0, max: 1_000_000 },
  "Communauté": { min: 0, max: 10_000 },
  "Matériel professionnel": { min: 1, max: 5_000_000 },
  "Bébé & Enfant": { min: 1, max: 10_000 },
  "Vacances": { min: 1, max: 50_000 },
  "Divers": { min: 0, max: 100_000 },
};

const SUBCATEGORY_PRICE_BOUNDS: Record<string, PriceBounds> = {
  "Ventes immobilières": { min: 5_000, max: 30_000_000 },
  "Locations": { min: 80, max: 30_000 },
  "Colocations": { min: 100, max: 3_000 },
  "Bureaux & commerces": { min: 100, max: 30_000_000 },
  "Locations de vacances": { min: 20, max: 50_000 },
  "Voitures": { min: 100, max: 2_000_000 },
  "Motos": { min: 50, max: 500_000 },
  "Utilitaires": { min: 200, max: 500_000 },
  "Caravaning": { min: 100, max: 500_000 },
  "Équipements auto": { min: 1, max: 50_000 },
};

const CURRENT_YEAR = new Date().getFullYear();

function hasForbidden(text: string): string | null {
  const norm = text.toLowerCase();
  for (const w of FORBIDDEN_WORDS) {
    if (norm.includes(w)) return w;
  }
  return null;
}

function upperRatio(text: string): number {
  const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  if (letters.length < 8) return 0;
  const upper = letters.replace(/[^A-ZÀ-Ÿ]/g, "").length;
  return upper / letters.length;
}

function describesNew(text: string): boolean {
  return /\b(neuf|neuve|neufs|neuves|jamais utilisé|sous blister|scellé)\b/i.test(text);
}

function describesUsed(text: string): boolean {
  return /\b(usé|usée|usagé|usagée|rayé|cassé|à réparer|pièces détachées|bon état|état correct|état moyen|état d'usage|traces d'usure)\b/i.test(text);
}

export function moderateListing(input: ModerationInput): ModerationResult {
  const flags: ModerationFlag[] = [];
  const add = (code: string, severity: ModerationSeverity, message: string) =>
    flags.push({ code, severity, message });

  const title = (input.title ?? "").trim();
  const description = (input.description ?? "").trim();
  const titleLower = title.toLowerCase();
  const descLower = description.toLowerCase();
  const full = `${title}\n${description}`;

  // 1. Mots interdits — rejet immédiat
  const forbiddenTitle = hasForbidden(title);
  if (forbiddenTitle) add("forbidden_title", "critical", `Terme interdit dans le titre : "${forbiddenTitle}"`);
  const forbiddenDesc = hasForbidden(description);
  if (forbiddenDesc) add("forbidden_desc", "critical", `Terme interdit dans la description : "${forbiddenDesc}"`);

  // 2. Leakage de contact
  if (PHONE_REGEX.test(title)) add("phone_in_title", "critical", "Numéro de téléphone dans le titre");
  if (EMAIL_REGEX.test(title)) add("email_in_title", "critical", "Adresse e-mail dans le titre");
  if (URL_REGEX.test(title)) add("url_in_title", "critical", "Lien URL dans le titre");
  if (URL_REGEX.test(description)) add("url_in_desc", "major", "Lien URL dans la description");
  if (EMAIL_REGEX.test(description)) add("email_in_desc", "major", "Adresse e-mail dans la description");
  if (PHONE_REGEX.test(description)) add("phone_in_desc", "minor", "Numéro de téléphone dans la description (préférer le champ dédié)");

  // 3. Qualité rédactionnelle
  if (title.length < 5) add("title_too_short", "major", "Titre trop court pour être descriptif");
  if (description.length < 30) add("desc_too_short", "major", "Description trop courte");
  if (upperRatio(title) > 0.7 && title.length > 10) add("title_all_caps", "minor", "Titre tout en majuscules");
  if (upperRatio(description) > 0.6 && description.length > 30) add("desc_all_caps", "minor", "Description majoritairement en majuscules");
  if (EXCESSIVE_REPEAT.test(title)) add("title_repeat", "minor", "Caractères répétés dans le titre");
  if (EXCESSIVE_EXCLAIM.test(title)) add("title_exclaim", "minor", "Ponctuation excessive dans le titre");

  // 4. Images
  if (!input.images || input.images.length === 0) {
    add("no_image", "major", "Aucune photo");
  }

  // 5. Catégorie / sous-catégorie
  const cat = getCategoryByLabel(input.category);
  if (!cat) {
    add("unknown_category", "critical", `Catégorie inconnue : "${input.category}"`);
  } else if (input.subcategory && !cat.subcategories.includes(input.subcategory)) {
    add("subcategory_mismatch", "major", `Sous-catégorie "${input.subcategory}" incompatible avec "${cat.label}"`);
  }

  // 6. Bornes de prix
  const bounds = (input.subcategory && SUBCATEGORY_PRICE_BOUNDS[input.subcategory]) ?? PRICE_BOUNDS[input.category];
  if (bounds) {
    if (input.price < bounds.min) {
      add("price_too_low", "major", `Prix anormalement bas pour ${input.subcategory ?? input.category} (min attendu ${bounds.min}€)`);
    }
    if (input.price > bounds.max) {
      add("price_too_high", "major", `Prix anormalement élevé pour ${input.subcategory ?? input.category} (max attendu ${bounds.max}€)`);
    }
  }

  // 7. Cohérence véhicule
  if (input.category === "Véhicules") {
    if (input.vehicleYear != null) {
      if (input.vehicleYear < 1900) add("vehicle_year_too_old", "major", `Année du véhicule invraisemblable : ${input.vehicleYear}`);
      if (input.vehicleYear > CURRENT_YEAR + 1) add("vehicle_year_future", "critical", `Année du véhicule dans le futur : ${input.vehicleYear}`);
    }
    if (input.vehicleKm != null) {
      if (input.vehicleKm < 0) add("vehicle_km_negative", "critical", "Kilométrage négatif");
      if (input.vehicleKm > 800_000) add("vehicle_km_too_high", "major", `Kilométrage très élevé : ${input.vehicleKm} km`);
      if (input.vehicleYear != null && input.vehicleYear > CURRENT_YEAR - 2 && input.vehicleKm > 100_000) {
        add("vehicle_km_vs_year", "minor", "Kilométrage élevé pour un véhicule récent");
      }
    }
  }

  // 8. Cohérence immobilier
  if (input.category === "Immobilier") {
    if (input.immoSurface != null) {
      if (input.immoSurface <= 0) add("immo_surface_invalid", "critical", "Surface invalide");
      if (input.immoSurface > 10_000) add("immo_surface_too_high", "major", `Surface invraisemblable : ${input.immoSurface} m²`);
    }
    if (input.immoRooms != null) {
      if (input.immoRooms < 0) add("immo_rooms_negative", "critical", "Nombre de pièces négatif");
      if (input.immoRooms > 20) add("immo_rooms_too_high", "major", `Nombre de pièces invraisemblable : ${input.immoRooms}`);
    }
    if (input.immoSurface && input.immoRooms) {
      const perRoom = input.immoSurface / input.immoRooms;
      if (perRoom < 5) add("immo_rooms_vs_surface", "major", `Surface par pièce trop faible (${perRoom.toFixed(1)} m²/pièce)`);
      if (perRoom > 200 && input.immoRooms > 1) add("immo_rooms_vs_surface_high", "minor", "Surface par pièce très élevée");
    }
    const mentionsStudio = /\bstudio\b/i.test(full);
    if (mentionsStudio && input.immoRooms && input.immoRooms > 1) {
      add("studio_vs_rooms", "major", `Texte mentionne "studio" mais ${input.immoRooms} pièces déclarées`);
    }
    const piecesMentioned = full.match(/\b(\d{1,2})\s*pi[eè]ces?\b/i);
    if (piecesMentioned && input.immoRooms) {
      const textRooms = parseInt(piecesMentioned[1]);
      if (Math.abs(textRooms - input.immoRooms) >= 2) {
        add("rooms_text_vs_field", "major", `Incohérence pièces : "${textRooms} pièces" dans le texte vs ${input.immoRooms} déclarées`);
      }
    }
  }

  // 9. Cohérence état neuf / occasion
  const isNewCondition = input.condition && /neuf/i.test(input.condition);
  if (isNewCondition && describesUsed(full)) {
    add("new_vs_used", "major", `État déclaré "neuf" mais texte suggère usage/usure`);
  }
  if (!isNewCondition && describesNew(full) && describesUsed(full)) {
    add("contradiction_new_used", "minor", "Texte mélange indications neuf et usagé");
  }

  // 10. Localisation
  if (input.location.trim().length < 3) {
    add("location_too_short", "major", "Localisation trop courte");
  }
  if (PHONE_REGEX.test(input.location) || URL_REGEX.test(input.location)) {
    add("location_noise", "critical", "La localisation contient autre chose qu'un lieu");
  }

  // 11. Contexte utilisateur
  const ctx = input.userContext;
  if (ctx && !ctx.isPro) {
    if (ctx.accountAgeHours < 1 && input.price > 5_000) {
      add("new_account_high_price", "major", "Compte créé il y a moins d'une heure et annonce à prix élevé");
    }
    if (ctx.recentListingsCount24h > 20) {
      add("burst_posting", "major", `Volume inhabituel (${ctx.recentListingsCount24h} annonces en 24h)`);
    }
  }

  // Verdict
  const critical = flags.filter((f) => f.severity === "critical").length;
  const major = flags.filter((f) => f.severity === "major").length;
  const minor = flags.filter((f) => f.severity === "minor").length;

  const score = Math.max(0, Math.min(1, 1 - 0.35 * critical - 0.15 * major - 0.05 * minor));

  let verdict: ModerationVerdict;
  if (critical > 0) verdict = "reject";
  else if (major >= 2) verdict = "reject";
  else if (major === 1) verdict = "review";
  else if (minor >= 2) verdict = "review";
  else verdict = "approve";

  const rejectReasons = flags
    .filter((f) => f.severity === "critical" || f.severity === "major")
    .map((f) => f.message);

  const publicReason = verdict === "reject" ? rejectReasons.slice(0, 3).join(" · ") : null;

  const adminNote = flags.length > 0
    ? flags.map((f) => `[${f.severity}] ${f.code}: ${f.message}`).join("\n")
    : "Aucun signal détecté";

  return { verdict, score, flags, publicReason, adminNote };
}

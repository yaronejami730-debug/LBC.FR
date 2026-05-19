/**
 * Helpers de pré-remplissage de formulaire (master prompt #2, Étape 7).
 *
 * Objectif : qu'une publication paraisse déjà presque finie. Aucune IA — on
 * réutilise les données structurées de l'utilisateur (dernière annonce du
 * même type, inscription waitlist, catégorie la plus visitée) et un prix
 * médian observé. Pure function : aucune dépendance Prisma.
 */

export type PrefillHints = {
  /** Dernière annonce publiée par l'utilisateur (ou `null`). */
  lastListing?: {
    category: string;       // id catégorie ("vehicules", "immobilier"…)
    subcategory?: string | null;
    location?: string | null;
    metadata?: Record<string, unknown>;
  } | null;
  /** Entrées waitlist de l'utilisateur (catégorie/ville pré-inscription). */
  waitlist?: { category?: string | null; city?: string | null }[];
  /** Catégorie du brouillon courant si présent — gagne sur tout. */
  draftCategory?: string | null;
  /** Histogramme des catégories visitées (localStorage côté client, agrégé). */
  pastCategoriesCount?: Record<string, number>;
  /** Prix médian pour la catégorie cible (calculé par l'appelant). */
  medianPriceForCategory?: number | null;
};

export type Prefill = {
  category: string | null;
  fields: Record<string, string | number | boolean>;
  estimatedPrice?: number;
  message: string;
};

const VEHICLE_KEYS = [
  "marque", "modele", "nomModele", "annee", "carburant",
  "transmission", "typeVehicule", "critAir",
] as const;

const IMMO_KEYS = [
  "typeBien", "surface", "rooms", "nombrePieces", "nombreChambres",
  "etage", "exposition", "etatBien", "classeEnergie",
] as const;

function pickCategory(h: PrefillHints): string | null {
  if (h.draftCategory) return h.draftCategory;
  const wl = h.waitlist?.find((w) => w.category)?.category;
  if (wl) return wl;
  if (h.pastCategoriesCount) {
    const sorted = Object.entries(h.pastCategoriesCount).sort((a, b) => b[1] - a[1]);
    if (sorted[0] && sorted[0][1] > 0) return sorted[0][0];
  }
  return h.lastListing?.category ?? null;
}

function copyKeys(
  src: Record<string, unknown> | undefined,
  keys: readonly string[],
): Record<string, string | number> {
  if (!src) return {};
  const out: Record<string, string | number> = {};
  for (const k of keys) {
    const v = src[k];
    if (typeof v === "string" && v.trim()) out[k] = v;
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

export function suggestPrefill(h: PrefillHints): Prefill | null {
  const category = pickCategory(h);
  if (!category) return null;

  const fields: Record<string, string | number | boolean> = {};
  const last = h.lastListing;
  const sameCat = last?.category === category;

  // Ville : dernière annonce > waitlist.
  const lastLocation = last?.location?.trim();
  const wlCity = h.waitlist?.find((w) => w.city)?.city;
  if (lastLocation) fields.location = lastLocation;
  else if (wlCity) fields.location = wlCity;

  if (sameCat && last?.metadata) {
    if (category === "vehicules") Object.assign(fields, copyKeys(last.metadata, VEHICLE_KEYS));
    else if (category === "immobilier") Object.assign(fields, copyKeys(last.metadata, IMMO_KEYS));
    if (last.subcategory) fields.subcategory = last.subcategory;
  }

  const estimatedPrice = h.medianPriceForCategory && h.medianPriceForCategory > 0
    ? Math.round(h.medianPriceForCategory)
    : undefined;

  // Message contextuel par catégorie (court, Étape 7).
  const catMsg: Record<string, string> = {
    vehicules: "Votre véhicule est déjà à moitié rempli — vérifiez et publiez.",
    immobilier: "Votre bien est presque prêt à être publié.",
    emploi: "Votre offre d'emploi est prête en quelques clics.",
    mode: "Votre article est presque prêt — vérifiez les détails.",
    maison: "Votre annonce maison est presque prête.",
    services: "Votre offre de service est presque prête.",
  };
  const message = catMsg[category] ?? "Votre annonce est presque prête.";

  return { category, fields, estimatedPrice, message };
}

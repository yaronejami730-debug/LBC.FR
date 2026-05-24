/**
 * Construit la liste des caractéristiques + équipements à afficher dans
 * l'écran détail d'annonce, en fonction de la catégorie et des metadata.
 * Garantit la cohérence visuelle quelle que soit la catégorie.
 */

export type Spec = { label: string; value: string; icon?: string };

const ICON_MAP: Record<string, string> = {
  "État": "checkmark-circle",
  "Catégorie": "pricetag",
  "Sous-catégorie": "pricetags",
  "Marque": "ribbon",
  "Modèle": "construct",
  "Année": "calendar",
  "Kilométrage": "speedometer",
  "Énergie": "flash",
  "Carburant": "flash",
  "Boîte de vitesse": "settings",
  "Boîte": "settings",
  "Nombre de places": "people",
  "Puissance fiscale": "flash-outline",
  "Couleur": "color-palette",
  "Surface": "expand",
  "Pièces": "grid",
  "Classe énergie": "leaf",
  "Étage": "trending-up",
  "Ascenseur": "swap-vertical",
  "Année de construction": "calendar",
  "Capacité": "save",
  "Garantie": "shield-checkmark",
  "État batterie": "battery-half",
  "Taille": "resize",
};

function iconFor(label: string): string | undefined {
  return ICON_MAP[label];
}

type Listing = {
  category: string;
  subcategory?: string | null;
  condition?: string | null;
  brand?: string | null;
  vehicleKm?: number | null;
  vehicleYear?: number | null;
  immoSurface?: number | null;
  immoRooms?: number | null;
};

type Metadata = Record<string, unknown>;

function parseMeta(raw: unknown): Metadata {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Metadata;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as Metadata; } catch { return {}; }
  }
  return {};
}

function s(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return String(v);
}

const VEHICLE_CATS = new Set(["Véhicules"]);
const IMMO_CATS = new Set(["Immobilier"]);
const ELEC_CATS = new Set(["Multimédia", "Électronique"]);

export function buildSpecs(listing: Listing, metadataRaw: unknown): Spec[] {
  const meta = parseMeta(metadataRaw);
  const specs: Spec[] = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value) specs.push({ label, value, icon: iconFor(label) });
  };

  // Toujours en tête
  if (listing.condition) push("État", listing.condition);
  push("Catégorie", listing.category);
  if (listing.subcategory) push("Sous-catégorie", listing.subcategory);

  const brand = s(meta.brand) ?? s(listing.brand);

  if (VEHICLE_CATS.has(listing.category)) {
    push("Marque", brand);
    push("Modèle", s(meta.model));
    push("Année", listing.vehicleYear ? String(listing.vehicleYear) : s(meta.year));
    push("Kilométrage", listing.vehicleKm ? `${listing.vehicleKm.toLocaleString("fr-FR")} km` : null);
    push("Énergie", s(meta.fuel) ?? s(meta.energy));
    push("Boîte de vitesse", s(meta.gearbox));
    push("Nombre de places", s(meta.seats));
    push("Puissance fiscale", meta.fiscalPower ? `${meta.fiscalPower} CV` : null);
    push("Couleur", s(meta.color));
  } else if (IMMO_CATS.has(listing.category)) {
    push("Surface", listing.immoSurface ? `${listing.immoSurface} m²` : null);
    push("Pièces", listing.immoRooms ? `${listing.immoRooms}` : null);
    push("Classe énergie", s(meta.energyClass));
    push("Étage", s(meta.floor));
    push("Ascenseur", typeof meta.elevator === "boolean" ? (meta.elevator ? "Oui" : "Non") : null);
    push("Année de construction", s(meta.constructionYear));
  } else if (ELEC_CATS.has(listing.category)) {
    push("Marque", brand);
    push("Modèle", s(meta.model));
    push("Capacité", s(meta.capacity));
    push("Couleur", s(meta.color));
    push("Garantie", s(meta.warranty));
    push("État batterie", s(meta.batteryHealth));
  } else {
    push("Marque", brand);
    push("Modèle", s(meta.model));
    push("Année", s(meta.year));
    push("Taille", s(meta.size));
    push("Couleur", s(meta.color));
  }

  return specs;
}

export function buildEquipment(metadataRaw: unknown): string[] {
  const meta = parseMeta(metadataRaw);
  const raw = meta.equipment ?? meta.equipments ?? meta.options;
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x)).filter((x) => x.trim());
  }
  if (typeof raw === "string") {
    return raw.split(/[,;|]/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

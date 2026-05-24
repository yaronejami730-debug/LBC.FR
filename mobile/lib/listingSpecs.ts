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
  "Modèle": "car-sport",
  "Année": "calendar",
  "Kilométrage": "speedometer",
  "Carburant": "flash",
  "Boîte": "settings",
  "Couleur": "color-palette",
  "Portes": "car",
  "Puissance": "flash-outline",
  "Motorisation": "cog",
  "Type": "list",
  "Places": "people",
  "Crit'Air": "leaf",
  "CO₂": "cloud",
  "Type de bien": "home",
  "Surface": "expand",
  "Pièces": "grid",
  "Chambres": "bed",
  "Salles d'eau": "water",
  "Étage": "trending-up",
  "Exposition": "sunny",
  "Classe énergie": "leaf",
  "GES": "cloud-outline",
  "Parking": "car",
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

  // Clés metadata réelles (cf. app/post/PostForm.tsx)
  const brand = s(meta.marque) ?? s(meta.brand) ?? s(listing.brand);
  const km = (() => {
    const raw = s(meta.kilometrage) ?? (listing.vehicleKm ? String(listing.vehicleKm) : null);
    if (!raw) return null;
    const n = parseInt(raw.replace(/\D/g, ""), 10);
    return isNaN(n) ? `${raw} km` : `${n.toLocaleString("fr-FR")} km`;
  })();
  const co2 = s(meta.emissionCO2);

  if (VEHICLE_CATS.has(listing.category)) {
    push("Marque", brand);
    push("Modèle", s(meta.modele) ?? s(meta.nomModele) ?? s(meta.model));
    push("Année", s(meta.annee) ?? (listing.vehicleYear ? String(listing.vehicleYear) : null));
    push("Kilométrage", km);
    push("Carburant", s(meta.carburant) ?? s(meta.fuel) ?? s(meta.energy));
    push("Boîte", s(meta.transmission) ?? s(meta.gearbox));
    push("Couleur", s(meta.couleur) ?? s(meta.color));
    push("Portes", s(meta.nombrePortes));
    push("Puissance", meta.puissanceFiscale ? `${s(meta.puissanceFiscale)} CV` : null);
    push("Motorisation", s(meta.motorisation));
    push("Type", s(meta.typeVehicule));
    push("Places", s(meta.nombrePlaces));
    push("Crit'Air", s(meta.critAir));
    push("CO₂", co2 ? `${co2} g/km` : null);
  } else if (IMMO_CATS.has(listing.category)) {
    push("Type de bien", s(meta.typeBien));
    push("Surface", (s(meta.surface) ?? (listing.immoSurface ? String(listing.immoSurface) : null)) ? `${s(meta.surface) ?? listing.immoSurface} m²` : null);
    push("Pièces", s(meta.rooms) ?? (listing.immoRooms ? String(listing.immoRooms) : null));
    push("Chambres", s(meta.chambres));
    push("Salles d'eau", s(meta.sallesEau));
    push("Étage", s(meta.etage));
    push("Exposition", s(meta.exposition));
    push("Classe énergie", s(meta.classeEnergie));
    push("GES", s(meta.ges));
    push("Parking", s(meta.placesParking));
    push("Année de construction", s(meta.anneeConstruction));
  } else if (ELEC_CATS.has(listing.category)) {
    push("Marque", brand);
    push("Modèle", s(meta.modele) ?? s(meta.model));
    push("Capacité", s(meta.capacity) ?? s(meta.capacite));
    push("Couleur", s(meta.couleur) ?? s(meta.color));
    push("Garantie", s(meta.warranty) ?? s(meta.garantie));
    push("État batterie", s(meta.batteryHealth));
  } else {
    push("Marque", brand);
    push("Modèle", s(meta.modele) ?? s(meta.model));
    push("Année", s(meta.annee) ?? s(meta.year));
    push("Taille", s(meta.taille) ?? s(meta.size));
    push("Couleur", s(meta.couleur) ?? s(meta.color));
  }

  return specs;
}

export function buildEquipment(metadataRaw: unknown): string[] {
  const meta = parseMeta(metadataRaw);
  const raw = meta.equipements ?? meta.equipment ?? meta.equipments ?? meta.caracteristiques ?? meta.options;
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x)).filter((x) => x.trim());
  }
  if (typeof raw === "string") {
    return raw.split(/[,;|]/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

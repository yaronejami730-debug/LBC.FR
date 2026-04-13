/**
 * Central search WHERE clause builder.
 * Used everywhere listings are filtered: search page, API, saved searches.
 *
 * Strategy:
 * - q          → full-text across ALL text columns + metadata JSON string
 * - category   → exact match (normalises label ↔ id)
 * - price      → gte / lte on price column
 * - location   → case-insensitive contains on location column
 * - condition  → case-insensitive exact match on condition column
 * - subcategoryType filters (vehicleType, propertyType, deviceType…)
 *               → contains match on subcategory column
 *               (e.g. "Voiture" ⊂ "Voitures", "Moto" ⊂ "Motos")
 * - metadata filters (fuel/carburant, gearbox/transmission, size, etc.)
 *               → metadata string contains the value
 *               (the JSON string stores the value literally)
 */

import { CATEGORIES } from "./categories";

export type SearchParams = Record<string, string | undefined | null>;

/**
 * Normalize any category value (id OR label) to the label stored in the DB.
 * Listings are saved with category = cat.label ("Véhicules", "Immobilier"…).
 */
function resolveCategoryLabel(raw: string): string {
  const hit = CATEGORIES.find(
    (c) => c.id === raw || c.label.toLowerCase() === raw.toLowerCase()
  );
  return hit ? hit.label : raw;
}

// Filter keys that map to subcategory contains
const SUBCATEGORY_FILTER_KEYS = new Set([
  "vehicleType",
  "propertyType",
  "transactionType",
  "deviceType",
  "animalType",
  "accommodationType",
  "serviceType",
  "communityType",
  "sector",
]);

// Filter keys that map to metadata string contains
const METADATA_FILTER_KEYS = new Set([
  "fuel",
  "gearbox",
  "size",
  "contractType",
  "experience",
  "animalAge",
  "childAge",
  "capacity",
]);

// Keys that are NOT passed to the filter engine (handled separately or ignored)
const SKIP_KEYS = new Set([
  "q", "category", "minPrice", "maxPrice", "location", "condition",
  "sort", "page", "_filters",
  // numeric range keys handled via dedicated columns
  "minKm", "maxKm", "minYear", "maxYear",
  "minSurface", "maxSurface", "minRooms", "maxRooms",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSearchWhere(
  params: SearchParams,
  opts: { includeNonApproved?: boolean } = {}
): any {
  const q         = params.q?.trim() || "";
  const category  = params.category ? resolveCategoryLabel(params.category) : "";
  const minPrice  = params.minPrice  ? parseFloat(params.minPrice)  : undefined;
  const maxPrice  = params.maxPrice  ? parseFloat(params.maxPrice)  : undefined;
  const location  = params.location?.trim()  || "";
  const condition = params.condition?.trim() || "";

  // Numeric range filters — use dedicated indexed columns
  const minKm      = params.minKm      ? parseInt(params.minKm)      : undefined;
  const maxKm      = params.maxKm      ? parseInt(params.maxKm)      : undefined;
  const minYear    = params.minYear    ? parseInt(params.minYear)    : undefined;
  const maxYear    = params.maxYear    ? parseInt(params.maxYear)    : undefined;
  const minSurface = params.minSurface ? parseFloat(params.minSurface) : undefined;
  const maxSurface = params.maxSurface ? parseFloat(params.maxSurface) : undefined;
  const minRooms   = params.minRooms   ? parseInt(params.minRooms)   : undefined;
  const maxRooms   = params.maxRooms   ? parseInt(params.maxRooms)   : undefined;

  // Subcategory-based filters (e.g. vehicleType="Voiture" → subcategory contains "Voiture")
  const subcategoryContains: string[] = [];
  // Metadata contains filters (e.g. fuel="Diesel" → metadata contains "Diesel")
  const metadataContains: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (!value || SKIP_KEYS.has(key)) continue;
    if (SUBCATEGORY_FILTER_KEYS.has(key)) {
      subcategoryContains.push(value);
    } else if (METADATA_FILTER_KEYS.has(key)) {
      metadataContains.push(value);
    }
  }

  // AND conditions array (all must match)
  const andConditions: object[] = [];

  if (subcategoryContains.length > 0) {
    // Multiple subcategory filters → all must match (unusual but safe)
    for (const val of subcategoryContains) {
      andConditions.push({
        subcategory: { contains: val, mode: "insensitive" },
      });
    }
  }

  if (metadataContains.length > 0) {
    for (const val of metadataContains) {
      andConditions.push({
        metadata: { contains: val, mode: "insensitive" },
      });
    }
  }

  return {
    ...(opts.includeNonApproved ? {} : { status: "APPROVED" }),
    deletedAt: null,

    // Full-text: q searches across ALL meaningful text fields + metadata JSON
    ...(q && {
      OR: [
        { title:       { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { location:    { contains: q, mode: "insensitive" } },
        { subcategory: { contains: q, mode: "insensitive" } },
        { condition:   { contains: q, mode: "insensitive" } },
        { brand:       { contains: q, mode: "insensitive" } },
        { material:    { contains: q, mode: "insensitive" } },
        // metadata is stored as a JSON string — catches marque, modèle,
        // carburant, couleur, immatriculation, etc. for vehicles
        { metadata:    { contains: q, mode: "insensitive" } },
      ],
    }),

    ...(category && { category }),

    ...((minPrice !== undefined || maxPrice !== undefined) && {
      price: {
        ...(minPrice !== undefined && { gte: minPrice }),
        ...(maxPrice !== undefined && { lte: maxPrice }),
      },
    }),

    ...(location && { location: { contains: location, mode: "insensitive" } }),

    ...(condition && { condition: { contains: condition, mode: "insensitive" } }),

    // Numeric range filters on dedicated columns
    ...((minKm !== undefined || maxKm !== undefined) && {
      vehicleKm: {
        ...(minKm !== undefined && { gte: minKm }),
        ...(maxKm !== undefined && { lte: maxKm }),
      },
    }),
    ...((minYear !== undefined || maxYear !== undefined) && {
      vehicleYear: {
        ...(minYear !== undefined && { gte: minYear }),
        ...(maxYear !== undefined && { lte: maxYear }),
      },
    }),
    ...((minSurface !== undefined || maxSurface !== undefined) && {
      immoSurface: {
        ...(minSurface !== undefined && { gte: minSurface }),
        ...(maxSurface !== undefined && { lte: maxSurface }),
      },
    }),
    ...((minRooms !== undefined || maxRooms !== undefined) && {
      immoRooms: {
        ...(minRooms !== undefined && { gte: minRooms }),
        ...(maxRooms !== undefined && { lte: maxRooms }),
      },
    }),

    ...(andConditions.length > 0 && { AND: andConditions }),
  };
}

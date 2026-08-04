/**
 * Lecture des attributs véhicule stockés dans `Listing.metadata`.
 *
 * Deux formats cohabitent en base, selon le point d'entrée :
 *   - `{"vehicle":{"marque":"Peugeot","modele":"2008",…}}` — import admin
 *     (`app/admin/actions.ts`) et extraction automatique ;
 *   - `{"marque":"Peugeot","modele":"2008",…}` — formulaire de publication
 *     (`app/post/PostForm.tsx`, qui sérialise l'objet véhicule à plat).
 *
 * Le code qui lisait `JSON.parse(metadata).modele` ne voyait donc que le second
 * format : les annonces importées — la majorité du stock véhicule — étaient
 * absentes des pages marque/modèle. Tout passe désormais par ce lecteur.
 */

export type VehicleMeta = {
  marque: string | null;
  modele: string | null;
};

type RawVehicle = { marque?: unknown; modele?: unknown };

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function parseVehicleMeta(metadata: string | null | undefined): VehicleMeta {
  if (!metadata) return { marque: null, modele: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(metadata);
  } catch {
    return { marque: null, modele: null };
  }
  if (typeof parsed !== "object" || parsed === null) return { marque: null, modele: null };

  const root = parsed as { vehicle?: unknown } & RawVehicle;
  const vehicle: RawVehicle =
    typeof root.vehicle === "object" && root.vehicle !== null ? (root.vehicle as RawVehicle) : root;

  return { marque: asString(vehicle.marque), modele: asString(vehicle.modele) };
}

/**
 * Fragment JSON à chercher en base pour filtrer sur une marque.
 *
 * `contains: "DS"` remontait n'importe quelle annonce dont le JSON contient ces
 * deux lettres. On cible le champ lui-même, ce qui fonctionne pour les deux
 * formats puisqu'ils écrivent tous deux `"marque":"…"`.
 */
export function brandMetadataFilter(brandName: string): string {
  return `"marque":"${brandName}"`;
}

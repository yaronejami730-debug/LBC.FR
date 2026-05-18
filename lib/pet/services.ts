export const SERVICE_TYPES = ["GARDE_DOMICILE", "GARDE_CHEZ_PRO", "PROMENADE"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_LABELS: Record<string, string> = {
  GARDE_DOMICILE: "Garde à domicile",
  GARDE_CHEZ_PRO: "Garde chez le pet-sitter",
  PROMENADE: "Promenade",
};

export const SERVICE_ICONS: Record<string, string> = {
  GARDE_DOMICILE: "home",
  GARDE_CHEZ_PRO: "hotel",
  PROMENADE: "directions_walk",
};

export const PET_TYPE_LABELS: Record<string, string> = {
  DOG: "Chien",
  CAT: "Chat",
  NAC: "NAC",
  BIRD: "Oiseau",
};

export function unitLabel(unit: string): string {
  return unit === "HOUR" ? "heure" : "jour";
}

export function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

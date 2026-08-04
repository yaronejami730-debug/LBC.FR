/**
 * Tranches de budget publicitaire proposées au prospect.
 *
 * On stocke la clé (stable, comparable, filtrable en admin) et on affiche le
 * libellé. Demander une tranche plutôt qu'un montant libre évite la saisie
 * fantaisiste et qualifie le lead dès le formulaire.
 */

export const ADVERTISER_BUDGETS = [
  { value: "moins-de-500", label: "Moins de 500 € / mois" },
  { value: "500-1500", label: "500 à 1 500 € / mois" },
  { value: "1500-5000", label: "1 500 à 5 000 € / mois" },
  { value: "plus-de-5000", label: "Plus de 5 000 € / mois" },
  { value: "a-definir", label: "À définir ensemble" },
] as const;

export type AdvertiserBudget = (typeof ADVERTISER_BUDGETS)[number]["value"];

export const BUDGET_LABELS = Object.fromEntries(
  ADVERTISER_BUDGETS.map((b) => [b.value, b.label]),
) as Record<AdvertiserBudget, string>;

export function isAdvertiserBudget(value: unknown): value is AdvertiserBudget {
  return typeof value === "string" && value in BUDGET_LABELS;
}

/** Statuts de suivi commercial. L'ordre est celui du pipeline. */
export const LEAD_STATUSES = [
  { value: "NEW", label: "Nouveau" },
  { value: "CONTACTED", label: "Contacté" },
  { value: "QUALIFIED", label: "Qualifié" },
  { value: "WON", label: "Signé" },
  { value: "LOST", label: "Perdu" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];

export const LEAD_STATUS_LABELS = Object.fromEntries(
  LEAD_STATUSES.map((s) => [s.value, s.label]),
) as Record<LeadStatus, string>;

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && value in LEAD_STATUS_LABELS;
}

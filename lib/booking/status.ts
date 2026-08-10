/**
 * Statuts d'un rendez-vous.
 *
 * Pas d'enum Prisma : le schéma du projet stocke ses statuts en `String` avec
 * l'union en commentaire (cf. `PetBooking.status`, `User.professionalStatus`).
 */

export const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/**
 * Statuts qui occupent réellement le créneau.
 *
 * ⚠️ Cette liste est dupliquée dans la clause `WHERE` de la contrainte
 * d'exclusion PostgreSQL (`ProBooking_no_overlap`, migration
 * 20260810050000_pro_booking). Les deux doivent bouger ensemble : élargir
 * cette liste sans toucher à la contrainte laisserait passer des chevauchements
 * en base, la restreindre ferait proposer des créneaux que la base refuse
 * ensuite.
 */
export const OCCUPYING_STATUSES: readonly BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
];

/** Statuts qui libèrent le créneau : il redevient réservable. */
export const RELEASING_STATUSES: readonly BookingStatus[] = ["CANCELLED", "NO_SHOW"];

export function isOccupying(status: string): boolean {
  return (OCCUPYING_STATUSES as readonly string[]).includes(status);
}

export function isBookingStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value);
}

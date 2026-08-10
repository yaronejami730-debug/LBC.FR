/**
 * Points d'ancrage des notifications de réservation.
 *
 * L'architecture est posée, les canaux ne sont pas tous branchés (§15). Le
 * choix ici est d'appeler `emit()` dès aujourd'hui aux bons endroits du code
 * métier : le jour où l'on connecte le SMS ou le rappel J-1, il n'y a qu'un
 * `case` à remplir, aucune route à rouvrir.
 *
 * Règle : une notification qui échoue ne doit jamais faire échouer la
 * réservation. Tout est encapsulé et avalé, avec trace en console.
 */

export type BookingEventType =
  | "booking.created"
  | "booking.confirmed"
  | "booking.cancelled"
  | "booking.rescheduled"
  | "booking.reminder24h"
  | "booking.reminder1h";

export type BookingEvent = {
  type: BookingEventType;
  bookingId: string;
  profileId: string;
  /** Destinataires connus au moment de l'émission. */
  customerEmail: string;
  customerId?: string | null;
};

/**
 * Canaux prévus. `email` s'appuiera sur `lib/email.ts`, `push` sur
 * `lib/notifications/send.ts` + `ExpoPushToken`, `sms` reste à connecter.
 * Les rappels J-1 et H-1 seront déclenchés par un cron, comme les autres
 * échéances du projet (`app/api/cron/**`).
 */
export type NotificationChannel = "email" | "push" | "sms";

export const CHANNELS_BY_EVENT: Record<BookingEventType, NotificationChannel[]> = {
  "booking.created": ["email", "push"],
  "booking.confirmed": ["email", "push"],
  "booking.cancelled": ["email", "push"],
  "booking.rescheduled": ["email", "push"],
  "booking.reminder24h": ["email", "push"],
  "booking.reminder1h": ["push", "sms"],
};

/**
 * Émet un événement de réservation.
 *
 * Volontairement inerte pour l'instant : elle trace et rend la main. Le
 * branchement effectif des canaux se fera ici, derrière la même signature.
 */
export async function emit(event: BookingEvent): Promise<void> {
  try {
    // À brancher : rendu du gabarit puis envoi sur CHANNELS_BY_EVENT[type].
    console.info("[booking] event", event.type, event.bookingId);
  } catch (error) {
    console.error("[booking] notification échouée", event.type, error);
  }
}

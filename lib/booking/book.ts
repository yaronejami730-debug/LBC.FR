/**
 * Création d'un rendez-vous.
 *
 * Deux verrous contre la double réservation, et le second est le seul qui
 * tienne réellement :
 *
 *   1. le créneau est recalculé côté serveur juste avant l'écriture — la liste
 *      affichée au client a pu vieillir de dix minutes ;
 *   2. la contrainte d'exclusion PostgreSQL `ProBooking_no_overlap` refuse
 *      physiquement deux rendez-vous qui se chevauchent pour un même membre.
 *
 * Le premier améliore le message d'erreur. Le second empêche le bug. Deux
 * requêtes concurrentes lisent toutes les deux « libre » avant que l'une
 * n'écrive : aucune vérification applicative ne peut fermer cette fenêtre,
 * c'est la base qui tranche.
 */
import { prisma } from "@/lib/prisma";
import { isSlotBookable } from "./availability";
import { ANY_MEMBER, BookingError, loadBookableService } from "./engine";
import {
  bookingLoadOn,
  loadBookingPolicy,
  loadEligibleMembers,
  loadMembersAvailability,
} from "./queries";
import { instantFromLocal, isDayKey } from "./time";

export type BookingContact = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  note?: string | null;
};

export type CreateBookingInput = {
  serviceId: string;
  /** Id de membre, ou `any` pour laisser le moteur choisir. */
  memberId: string;
  /** Jour local `YYYY-MM-DD`. */
  day: string;
  /** Minutes depuis minuit local. */
  startMin: number;
  contact: BookingContact;
  /** Renseigné si le client est connecté ; la réservation reste possible sans. */
  customerId?: string | null;
  /**
   * D'où vient le rendez-vous. `PHONE` et `MANUAL` désignent une saisie par le
   * professionnel lui-même — mêmes règles, même moteur, seule la provenance
   * change.
   */
  source?: "ONLINE" | "PHONE" | "MANUAL";
  /**
   * Force la confirmation immédiate.
   *
   * Un rendez-vous pris au téléphone n'a rien à attendre : le professionnel
   * vient de parler au client. Le laisser en attente de sa propre validation
   * n'aurait aucun sens.
   */
  forceConfirm?: boolean;
  now?: Date;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Indicatif optionnel, 8 à 15 chiffres — assez large pour l'international. */
const PHONE_RE = /^\+?[\d\s.\-()]{8,20}$/;

/** Vrai quand PostgreSQL a rejeté l'écriture pour cause de chevauchement. */
function isOverlapViolation(error: unknown): boolean {
  const text = JSON.stringify(
    error instanceof Error ? { m: error.message, ...(error as object) } : error,
  );
  return text.includes("23P01") || text.includes("ProBooking_no_overlap");
}

function validate(input: CreateBookingInput): void {
  if (!isDayKey(input.day)) throw new BookingError("Date invalide.", 400, "INVALID_DAY");
  if (!Number.isInteger(input.startMin) || input.startMin < 0 || input.startMin >= 1440) {
    throw new BookingError("Horaire invalide.", 400, "INVALID_TIME");
  }
  const { firstName, lastName, phone, email } = input.contact;
  if (!firstName?.trim() || !lastName?.trim()) {
    throw new BookingError("Prénom et nom sont requis.", 400, "MISSING_NAME");
  }
  // En ligne, l'email est la seule façon de renvoyer la confirmation : il reste
  // obligatoire. Au téléphone, le professionnel a le client en ligne et ne le
  // demande pas toujours — l'exiger bloquerait la prise de rendez-vous.
  const emailOptional = input.source === "PHONE" || input.source === "MANUAL";
  const trimmedEmail = email?.trim() ?? "";
  if (!emailOptional || trimmedEmail) {
    if (!EMAIL_RE.test(trimmedEmail)) {
      throw new BookingError("Adresse email invalide.", 400, "INVALID_EMAIL");
    }
  }
  if (!PHONE_RE.test(phone?.trim() ?? "")) {
    throw new BookingError("Numéro de téléphone invalide.", 400, "INVALID_PHONE");
  }
}

export async function createBooking(input: CreateBookingInput) {
  const now = input.now ?? new Date();
  validate(input);

  const service = await loadBookableService(input.serviceId);
  const duration = service.durationMin as number;
  const policy = await loadBookingPolicy(service.profileId);

  const eligible = await loadEligibleMembers(input.serviceId);
  const requested =
    input.memberId === ANY_MEMBER ? eligible : eligible.filter((m) => m.id === input.memberId);
  if (requested.length === 0) {
    throw new BookingError("Ce praticien ne réalise pas cette prestation.", 409, "MEMBER_NOT_ELIGIBLE");
  }

  const availability = await loadMembersAvailability(
    requested.map((m) => m.id),
    input.day,
    input.day,
    service.profileId,
  );

  // Candidats réellement libres à cette heure, du moins chargé au plus chargé.
  // En mode « peu importe », c'est ce qui répartit le travail dans l'équipe
  // plutôt que de saturer la première personne de la liste.
  const candidates = requested
    .map((member) => ({ member, data: availability.get(member.id) }))
    .filter(
      (c) =>
        c.data &&
        isSlotBookable(c.data, input.day, input.startMin, duration, policy, now),
    )
    .sort((a, b) => bookingLoadOn(a.data!, input.day) - bookingLoadOn(b.data!, input.day));

  if (candidates.length === 0) {
    throw new BookingError("Ce créneau n'est plus disponible.", 409, "SLOT_TAKEN");
  }

  const startAt = instantFromLocal(input.day, input.startMin);
  const endAt = instantFromLocal(input.day, input.startMin + duration);
  const status = input.forceConfirm || policy.autoConfirm ? "CONFIRMED" : "PENDING";

  // On tente chaque candidat : si un autre client emporte le créneau pendant
  // l'écriture, la contrainte rejette l'insertion et on bascule sur le
  // praticien suivant. Le client n'a rien à refaire tant qu'il reste quelqu'un.
  for (const candidate of candidates) {
    try {
      return await prisma.proBooking.create({
        data: {
          profileId: service.profileId,
          memberId: candidate.member.id,
          serviceId: service.id,
          customerId: input.customerId ?? null,
          startAt,
          endAt,
          firstName: input.contact.firstName.trim(),
          lastName: input.contact.lastName.trim(),
          phone: input.contact.phone.trim(),
          email: input.contact.email?.trim().toLowerCase() ?? "",
          source: input.source ?? "ONLINE",
          note: input.contact.note?.trim() || null,
          priceSnapshot: service.price,
          durationSnapshot: duration,
          labelSnapshot: service.label,
          status,
          confirmedAt: status === "CONFIRMED" ? new Date() : null,
        },
        include: { member: true, service: true, profile: true },
      });
    } catch (error) {
      // Un autre client a emporté ce praticien pendant l'écriture : on essaie
      // le suivant. Toute autre erreur remonte telle quelle.
      if (!isOverlapViolation(error)) throw error;
    }
  }

  throw new BookingError("Ce créneau vient d'être réservé.", 409, "SLOT_TAKEN");
}

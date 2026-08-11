/**
 * Orchestration : ce que les routes API appellent réellement.
 *
 * Assemble le chargement (`queries.ts`) et le calcul (`availability.ts`). Web
 * et mobile passent tous les deux par ici — c'est ce qui garantit qu'ils
 * obtiennent les mêmes créneaux, sans qu'aucune règle ne soit réécrite côté
 * client.
 */
import { prisma } from "@/lib/prisma";
import {
  mergeSlots,
  slotsForMember,
  type Slot,
  type SlotRules,
} from "./availability";
import {
  bookingLoadOn,
  loadBookingPolicy,
  loadEligibleMembers,
  loadMembersAvailability,
  type BookingPolicy,
} from "./queries";
import { addDays, daysBetweenKeys, formatMinutes } from "./time";

/** Valeur admise pour « peu importe le praticien ». */
export const ANY_MEMBER = "any";

/** Garde-fou : un calendrier annuel en une requête est un déni de service. */
const MAX_RANGE_DAYS = 62;

export class BookingError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export type BookableService = Awaited<ReturnType<typeof loadBookableService>>;

/**
 * Charge une prestation réservable, ou explique pourquoi elle ne l'est pas.
 *
 * Les contrôles sont ici plutôt que dans chaque route : une fiche dépubliée ou
 * une ligne « sur devis » ne doit jamais produire de créneau, quel que soit le
 * point d'entrée.
 */
export async function loadBookableService(serviceId: string) {
  const service = await prisma.proService.findUnique({
    where: { id: serviceId },
    include: { profile: true },
  });

  if (!service) throw new BookingError("Prestation introuvable.", 404, "SERVICE_NOT_FOUND");
  if (!service.profile.isPublished) {
    throw new BookingError("Cet établissement n'est pas ouvert à la réservation.", 404, "PROFILE_UNPUBLISHED");
  }
  if (!service.isActive || !service.isBookable) {
    throw new BookingError("Cette prestation n'est pas réservable en ligne.", 409, "SERVICE_NOT_BOOKABLE");
  }
  if (!service.durationMin || service.durationMin <= 0) {
    // Sans durée, le moteur ne sait pas combien de temps bloquer : on refuse
    // plutôt que d'inventer un défaut qui décalerait tout l'agenda.
    throw new BookingError("Cette prestation n'a pas de durée définie.", 409, "SERVICE_NO_DURATION");
  }

  return service;
}

type Resolved = {
  service: NonNullable<Awaited<ReturnType<typeof loadBookableService>>>;
  policy: BookingPolicy;
  rules: SlotRules;
  members: Awaited<ReturnType<typeof loadEligibleMembers>>;
};

async function resolve(serviceId: string, memberId: string): Promise<Resolved> {
  const service = await loadBookableService(serviceId);
  const policy = await loadBookingPolicy(service.profileId);

  const eligible = await loadEligibleMembers(serviceId);
  if (eligible.length === 0) {
    throw new BookingError(
      "Aucun praticien ne propose cette prestation pour le moment.",
      409,
      "NO_ELIGIBLE_MEMBER",
    );
  }

  const members =
    memberId === ANY_MEMBER ? eligible : eligible.filter((m) => m.id === memberId);
  if (members.length === 0) {
    throw new BookingError(
      "Ce praticien ne réalise pas cette prestation.",
      409,
      "MEMBER_NOT_ELIGIBLE",
    );
  }

  const rules: SlotRules = {
    slotGranularityMin: policy.slotGranularityMin,
    bufferMin: policy.bufferMin,
    minNoticeMin: policy.minNoticeMin,
    maxAdvanceDays: policy.maxAdvanceDays,
  };

  return { service, policy, rules, members };
}

export type SlotView = Slot & {
  /** « 14:30 », prêt à afficher. */
  label: string;
  memberName: string;
};

/** Créneaux d'une journée. `memberId` vaut `any` pour le mode « peu importe ». */
export async function getSlots(params: {
  serviceId: string;
  memberId: string;
  day: string;
  now?: Date;
}): Promise<{ day: string; durationMin: number; slots: SlotView[] }> {
  const now = params.now ?? new Date();
  const { service, rules, members } = await resolve(params.serviceId, params.memberId);
  const duration = service.durationMin as number;

  const availability = await loadMembersAvailability(
    members.map((m) => m.id),
    params.day,
    params.day,
    service.profileId,
  );

  const perMember = members.map((member) => {
    const data = availability.get(member.id);
    if (!data) return { slots: [], load: 0 };
    return {
      slots: slotsForMember(data, params.day, duration, rules, now),
      load: bookingLoadOn(data, params.day),
    };
  });

  const nameById = new Map(members.map((m) => [m.id, m.displayName]));

  return {
    day: params.day,
    durationMin: duration,
    slots: mergeSlots(perMember).map((slot) => ({
      ...slot,
      label: formatMinutes(slot.startMin),
      memberName: nameById.get(slot.memberId) ?? "",
    })),
  };
}

/**
 * Jours qui comportent au moins un créneau, pour griser le calendrier.
 *
 * On calcule vraiment les créneaux plutôt que de se contenter des horaires
 * d'ouverture : une journée pleine ou entièrement en congé doit apparaître
 * fermée, sinon le client la choisit pour découvrir qu'elle est vide.
 */
export async function getOpenDays(params: {
  serviceId: string;
  memberId: string;
  from: string;
  to: string;
  now?: Date;
}): Promise<{ from: string; to: string; days: string[] }> {
  const now = params.now ?? new Date();
  const span = daysBetweenKeys(params.from, params.to);
  if (span < 0) throw new BookingError("Plage de dates inversée.", 400, "INVALID_RANGE");
  if (span > MAX_RANGE_DAYS) {
    throw new BookingError(`Plage limitée à ${MAX_RANGE_DAYS} jours.`, 400, "RANGE_TOO_WIDE");
  }

  const { service, rules, members } = await resolve(params.serviceId, params.memberId);
  const duration = service.durationMin as number;

  const availability = await loadMembersAvailability(
    members.map((m) => m.id),
    params.from,
    params.to,
    service.profileId,
  );

  const days: string[] = [];
  for (let i = 0; i <= span; i++) {
    const day = addDays(params.from, i);
    const open = members.some((member) => {
      const data = availability.get(member.id);
      return data ? slotsForMember(data, day, duration, rules, now).length > 0 : false;
    });
    if (open) days.push(day);
  }

  return { from: params.from, to: params.to, days };
}

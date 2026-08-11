/**
 * Chargement des données du moteur de créneaux.
 *
 * Seul endroit du module qui parle à la base. `availability.ts` reste pur :
 * on lui passe ce qui est lu ici, il ne va rien chercher lui-même.
 */
import { prisma } from "@/lib/prisma";
import { OCCUPYING_STATUSES } from "./status";
import { DEFAULT_SLOT_RULES, type MemberAvailability, type SlotRules } from "./availability";
import { addDays, instantFromLocal, MINUTES_PER_DAY } from "./time";

export type BookingPolicy = SlotRules & {
  autoConfirm: boolean;
  allowCancel: boolean;
  allowReschedule: boolean;
  cancelDeadlineMin: number;
};

export const DEFAULT_BOOKING_POLICY: BookingPolicy = {
  ...DEFAULT_SLOT_RULES,
  autoConfirm: true,
  allowCancel: true,
  allowReschedule: true,
  cancelDeadlineMin: 1440,
};

/**
 * Règles de l'établissement. La ligne `ProBookingSettings` est optionnelle :
 * un pro doit pouvoir ouvrir la réservation sans rien configurer, d'où le
 * repli sur les valeurs par défaut plutôt qu'une erreur.
 */
export async function loadBookingPolicy(profileId: string): Promise<BookingPolicy> {
  const row = await prisma.proBookingSettings.findUnique({ where: { profileId } });
  if (!row) return DEFAULT_BOOKING_POLICY;
  return {
    slotGranularityMin: row.slotGranularityMin,
    bufferMin: row.bufferMin,
    minNoticeMin: row.minNoticeMin,
    maxAdvanceDays: row.maxAdvanceDays,
    autoConfirm: row.autoConfirm,
    allowCancel: row.allowCancel,
    allowReschedule: row.allowReschedule,
    cancelDeadlineMin: row.cancelDeadlineMin,
  };
}

/**
 * Membres capables d'assurer la prestation, dans l'ordre d'affichage du pro.
 * Un membre désactivé n'est jamais proposé, même s'il garde ses compétences.
 */
export async function loadEligibleMembers(serviceId: string) {
  const service = await prisma.proService.findUnique({
    where: { id: serviceId },
    select: { profileId: true },
  });
  if (!service) return [];

  const links = await prisma.proMemberService.findMany({
    where: {
      serviceId,
      member: {
        isActive: true,
        // Le membre doit exercer dans l'établissement de la prestation : soit
        // il y est rattaché d'origine, soit il y est prêté par le groupe
        // (`ProMemberEstablishment`). Sans ce filtre, une coiffeuse partagée
        // entre deux boutiques serait proposée dans celle où elle ne vient
        // jamais.
        OR: [
          { profileId: service.profileId },
          { establishments: { some: { profileId: service.profileId } } },
        ],
      },
    },
    include: { member: true },
    orderBy: { member: { position: "asc" } },
  });
  return links.map((l) => l.member);
}

/**
 * Plannings des membres sur une fenêtre de jours locaux.
 *
 * Les rendez-vous et absences sont chargés une seule fois pour toute la
 * fenêtre : une requête par jour ferait exploser le coût d'un calendrier
 * mensuel. La fenêtre est élargie d'un jour de chaque côté pour attraper ce
 * qui chevauche minuit.
 */
export async function loadMembersAvailability(
  memberIds: string[],
  fromDay: string,
  toDay: string,
  /**
   * Établissement pour lequel on calcule. Les horaires et les pauses lui sont
   * propres — Nathalie est lundi-mercredi à Paris et jeudi-vendredi à Neuilly,
   * et sans ce filtre elle serait réservable partout tous les jours.
   *
   * Facultatif : les plannings enregistrés avant le multi-établissement n'ont
   * pas de `profileId`, ils valent alors pour l'établissement d'origine.
   */
  profileId?: string,
): Promise<Map<string, MemberAvailability>> {
  if (memberIds.length === 0) return new Map();

  const windowStart = instantFromLocal(addDays(fromDay, -1), 0);
  const windowEnd = instantFromLocal(addDays(toDay, 1), MINUTES_PER_DAY);

  // Les rendez-vous, eux, ne sont jamais filtrés par établissement : une
  // personne ne peut pas être à deux endroits à la fois, et un créneau pris
  // dans une boutique doit bloquer l'autre.
  const scopedToProfile = profileId
    ? { OR: [{ profileId }, { profileId: null }] }
    : {};

  const [hours, breaks, timeOff, bookings] = await Promise.all([
    prisma.proWorkingHours.findMany({ where: { memberId: { in: memberIds }, ...scopedToProfile } }),
    prisma.proBreak.findMany({ where: { memberId: { in: memberIds }, ...scopedToProfile } }),
    prisma.proTimeOff.findMany({
      where: { memberId: { in: memberIds }, startAt: { lt: windowEnd }, endAt: { gt: windowStart } },
    }),
    prisma.proBooking.findMany({
      where: {
        memberId: { in: memberIds },
        status: { in: [...OCCUPYING_STATUSES] },
        startAt: { lt: windowEnd },
        endAt: { gt: windowStart },
      },
      select: { memberId: true, startAt: true, endAt: true },
    }),
  ]);

  const out = new Map<string, MemberAvailability>();
  for (const memberId of memberIds) {
    out.set(memberId, {
      memberId,
      workingHours: hours.filter((h) => h.memberId === memberId),
      breaks: breaks.filter((b) => b.memberId === memberId),
      timeOff: timeOff.filter((t) => t.memberId === memberId),
      bookings: bookings.filter((b) => b.memberId === memberId),
    });
  }
  return out;
}

/** Nombre de rendez-vous d'un membre sur la journée — sert au « peu importe ». */
export function bookingLoadOn(availability: MemberAvailability, targetDay: string): number {
  const dayStart = instantFromLocal(targetDay, 0).getTime();
  const dayEnd = instantFromLocal(targetDay, MINUTES_PER_DAY).getTime();
  return availability.bookings.filter(
    (b) => b.startAt.getTime() < dayEnd && b.endAt.getTime() > dayStart,
  ).length;
}

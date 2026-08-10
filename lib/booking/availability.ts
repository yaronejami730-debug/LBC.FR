/**
 * Moteur de créneaux — le cœur du module de réservation.
 *
 * Fonctions pures : aucune requête, aucune horloge implicite. Tout entre par
 * les paramètres (`now` compris), donc le comportement est reproductible et
 * testable sans base de données. Les routes API se contentent de charger les
 * données et d'appeler ces fonctions.
 *
 * Principe, pour un membre et une journée :
 *
 *     horaires de travail          [10:00 → 19:00]
 *   − pauses récurrentes         − [12:30 → 13:30]
 *   − rendez-vous existants      − [14:00 → 14:45]  (élargis du battement)
 *   − absences ponctuelles       − [16:00 → 17:00]
 *   = plages libres
 *   → découpées au pas de la grille, on ne garde que celles où la prestation
 *     tient entièrement.
 *
 * Tout est en minutes depuis minuit, heure de Paris (cf. `./time`).
 */
import { MINUTES_PER_DAY, dayKey, instantFromLocal, minutesOfDay, weekdayOf } from "./time";

/** Plage en minutes depuis minuit local. `end` exclu. */
export type Interval = { start: number; end: number };

export type RecurringSlot = { weekday: number; startMin: number; endMin: number };
export type DatedSlot = { startAt: Date; endAt: Date };

export type MemberAvailability = {
  memberId: string;
  workingHours: RecurringSlot[];
  breaks: RecurringSlot[];
  timeOff: DatedSlot[];
  bookings: DatedSlot[];
};

export type SlotRules = {
  slotGranularityMin: number;
  bufferMin: number;
  minNoticeMin: number;
  maxAdvanceDays: number;
};

export const DEFAULT_SLOT_RULES: SlotRules = {
  slotGranularityMin: 15,
  bufferMin: 0,
  minNoticeMin: 120,
  maxAdvanceDays: 60,
};

export type Slot = {
  /** Minutes depuis minuit local. */
  startMin: number;
  endMin: number;
  /** Membre qui assurera le rendez-vous — jamais nul, même en mode « peu importe ». */
  memberId: string;
};

/* -------------------------------------------------------------------------- *
 * Algèbre d'intervalles
 * -------------------------------------------------------------------------- */

/** Fusionne les plages qui se touchent ou se chevauchent, et les trie. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const valid = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const current of valid) {
    const last = out[out.length - 1];
    if (last && current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      out.push({ ...current });
    }
  }
  return out;
}

/**
 * Retire `cuts` de `base`. Une coupure au milieu d'une plage la scinde en deux
 * — c'est ce qui produit « 10h–12h30 » et « 13h30–19h » à partir d'une journée
 * continue et d'une pause déjeuner.
 */
export function subtractIntervals(base: Interval[], cuts: Interval[]): Interval[] {
  const holes = mergeIntervals(cuts);
  let result = mergeIntervals(base);

  for (const hole of holes) {
    const next: Interval[] = [];
    for (const piece of result) {
      if (hole.end <= piece.start || hole.start >= piece.end) {
        next.push(piece);
        continue;
      }
      if (hole.start > piece.start) next.push({ start: piece.start, end: hole.start });
      if (hole.end < piece.end) next.push({ start: hole.end, end: piece.end });
    }
    result = next;
  }
  return result;
}

/**
 * Projette une plage datée sur une journée locale. Renvoie `null` si elle ne
 * la touche pas. Une absence de trois jours est donc rognée aux bornes de
 * chaque journée qu'elle traverse, sans traitement particulier.
 */
export function clipToDay(slot: DatedSlot, targetDay: string): Interval | null {
  const dayStart = instantFromLocal(targetDay, 0);
  const dayEnd = instantFromLocal(targetDay, MINUTES_PER_DAY);
  const startMs = Math.max(slot.startAt.getTime(), dayStart.getTime());
  const endMs = Math.min(slot.endAt.getTime(), dayEnd.getTime());
  if (endMs <= startMs) return null;

  const start = Math.round((startMs - dayStart.getTime()) / 60_000);
  const end = Math.round((endMs - dayStart.getTime()) / 60_000);
  return { start, end };
}

/* -------------------------------------------------------------------------- *
 * Disponibilité
 * -------------------------------------------------------------------------- */

/** Plages réellement libres du membre pour la journée, avant découpe. */
export function freeIntervals(
  member: MemberAvailability,
  targetDay: string,
  rules: SlotRules,
): Interval[] {
  const weekday = weekdayOf(targetDay);

  const working = member.workingHours
    .filter((h) => h.weekday === weekday)
    .map((h) => ({ start: h.startMin, end: h.endMin }));
  if (working.length === 0) return [];

  const cuts: Interval[] = member.breaks
    .filter((b) => b.weekday === weekday)
    .map((b) => ({ start: b.startMin, end: b.endMin }));

  for (const off of member.timeOff) {
    const clipped = clipToDay(off, targetDay);
    if (clipped) cuts.push(clipped);
  }

  // Le battement encadre le rendez-vous des deux côtés : c'est un temps de
  // remise en état du poste, il vaut avant comme après.
  for (const booking of member.bookings) {
    const clipped = clipToDay(booking, targetDay);
    if (clipped) {
      cuts.push({
        start: clipped.start - rules.bufferMin,
        end: clipped.end + rules.bufferMin,
      });
    }
  }

  return subtractIntervals(working, cuts);
}

/**
 * Créneaux proposables pour un membre, une journée et une durée.
 *
 * La grille est calée sur minuit : avec un pas de 15 min on obtient 14:00,
 * 14:15, 14:30… quelle que soit l'heure d'ouverture. Un pro qui ouvre à 9h05
 * verra donc son premier créneau à 9h15 — prévisible, et aligné entre les
 * membres d'une même équipe.
 */
export function slotsForMember(
  member: MemberAvailability,
  targetDay: string,
  durationMin: number,
  rules: SlotRules,
  now: Date,
): Slot[] {
  if (durationMin <= 0) return [];
  const granularity = Math.max(1, rules.slotGranularityMin);

  const earliest = earliestBookableMinute(targetDay, rules, now);
  if (earliest === null) return [];

  const slots: Slot[] = [];
  for (const free of freeIntervals(member, targetDay, rules)) {
    const first = Math.ceil(Math.max(free.start, earliest) / granularity) * granularity;
    for (let start = first; start + durationMin <= free.end; start += granularity) {
      slots.push({ startMin: start, endMin: start + durationMin, memberId: member.memberId });
    }
  }
  return slots;
}

/**
 * Première minute réservable de la journée compte tenu du préavis et de
 * l'horizon. `null` quand la journée est entièrement hors fenêtre : passée,
 * trop proche, ou trop lointaine.
 */
export function earliestBookableMinute(
  targetDay: string,
  rules: SlotRules,
  now: Date,
): number | null {
  const horizon = new Date(now.getTime() + rules.maxAdvanceDays * MINUTES_PER_DAY * 60_000);
  if (targetDay > dayKey(horizon)) return null;

  const notice = new Date(now.getTime() + rules.minNoticeMin * 60_000);
  const noticeDay = dayKey(notice);
  if (targetDay < noticeDay) return null;
  if (targetDay > noticeDay) return 0;
  return minutesOfDay(notice);
}

/**
 * Mode « peu importe » : agrège les créneaux de plusieurs membres.
 *
 * Un même horaire proposé par deux personnes ne doit apparaître qu'une fois —
 * le client choisit une heure, pas un planning. On retient le membre le moins
 * chargé ce jour-là, ce qui répartit le travail au lieu de saturer le premier
 * de la liste.
 */
export function mergeSlots(perMember: { slots: Slot[]; load: number }[]): Slot[] {
  const best = new Map<number, { slot: Slot; load: number }>();

  for (const { slots, load } of perMember) {
    for (const slot of slots) {
      const current = best.get(slot.startMin);
      if (!current || load < current.load) best.set(slot.startMin, { slot, load });
    }
  }

  return [...best.values()].map((e) => e.slot).sort((a, b) => a.startMin - b.startMin);
}

/**
 * Vérifie qu'un créneau précis est bien proposable. Rejoué côté serveur juste
 * avant l'écriture : le client a pu garder sa page ouverte dix minutes, et la
 * liste qu'il a sous les yeux ne prouve plus rien.
 */
export function isSlotBookable(
  member: MemberAvailability,
  targetDay: string,
  startMin: number,
  durationMin: number,
  rules: SlotRules,
  now: Date,
): boolean {
  return slotsForMember(member, targetDay, durationMin, rules, now).some(
    (s) => s.startMin === startMin,
  );
}

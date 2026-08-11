import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingError } from "@/lib/booking/engine";
import { bookingErrorResponse, requireOwnedMember, requireProProfile } from "@/lib/booking/http";
import { MINUTES_PER_DAY } from "@/lib/booking/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SlotInput = { weekday?: unknown; startMin?: unknown; endMin?: unknown; label?: unknown };

/** Horaires et pauses d'un membre. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { profile } = await requireProProfile(req, "staff");
    await requireOwnedMember(profile.id, id);

    const [workingHours, breaks] = await Promise.all([
      // Lecture symétrique de l'écriture : on ne montre que le planning de
      // l'établissement courant.
      prisma.proWorkingHours.findMany({
        where: { memberId: id, profileId: profile.id },
        orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
      }),
      prisma.proBreak.findMany({
        where: { memberId: id, profileId: profile.id },
        orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
      }),
    ]);

    return NextResponse.json({ memberId: id, workingHours, breaks });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

/**
 * Remplace le planning hebdomadaire du membre.
 *
 * Deux plages le même jour = deux entrées (matin, après-midi) : c'est ce qui
 * évite d'inventer une syntaxe de coupure dans un horaire. Les pauses sont
 * séparées parce qu'elles se soustraient à l'ouverture, elles ne la découpent
 * pas — un pro qui déplace sa pause déjeuner ne doit pas ressaisir sa journée.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { profile } = await requireProProfile(req, "staff");
    await requireOwnedMember(profile.id, id);

    const body = (await req.json().catch(() => ({}))) as {
      workingHours?: SlotInput[];
      breaks?: SlotInput[];
    };

    const workingHours = normalize(body.workingHours ?? [], "workingHours");
    const breaks = normalize(body.breaks ?? [], "breaks");

    await prisma.$transaction([
      // Portée à l'établissement courant : un `deleteMany` sur le seul
      // `memberId` effacerait aussi le planning que ce collaborateur tient
      // dans les autres boutiques du groupe.
      prisma.proWorkingHours.deleteMany({ where: { memberId: id, profileId: profile.id } }),
      prisma.proBreak.deleteMany({ where: { memberId: id, profileId: profile.id } }),
      // `profileId` : les horaires appartiennent au couple (membre,
      // établissement). Le même collaborateur peut être lundi-mercredi dans
      // une boutique et jeudi-vendredi dans une autre.
      prisma.proWorkingHours.createMany({
        data: workingHours.map((s) => ({
          memberId: id,
          profileId: profile.id,
          weekday: s.weekday,
          startMin: s.startMin,
          endMin: s.endMin,
        })),
      }),
      prisma.proBreak.createMany({
        data: breaks.map((s) => ({
          memberId: id,
          profileId: profile.id,
          weekday: s.weekday,
          startMin: s.startMin,
          endMin: s.endMin,
          label: s.label,
        })),
      }),
    ]);

    return NextResponse.json({ memberId: id, workingHours, breaks });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

/**
 * Valide et borne les plages reçues.
 *
 * Une plage inversée ou hors journée passerait sans bruit jusqu'au moteur, où
 * elle produirait soit zéro créneau soit des créneaux fantômes à 25 h. Autant
 * refuser à l'écriture, là où le pro peut encore corriger.
 */
function normalize(input: SlotInput[], field: string) {
  if (!Array.isArray(input)) throw new BookingError(`\`${field}\` doit être une liste.`, 400, "INVALID_SCHEDULE");
  if (input.length > 100) throw new BookingError(`\`${field}\` : trop d'entrées.`, 400, "INVALID_SCHEDULE");

  const slots = input.map((raw) => {
    const weekday = Number(raw.weekday);
    const startMin = Number(raw.startMin);
    const endMin = Number(raw.endMin);

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw new BookingError("Jour de semaine invalide (0 = dimanche … 6 = samedi).", 400, "INVALID_WEEKDAY");
    }
    if (!Number.isInteger(startMin) || !Number.isInteger(endMin)) {
      throw new BookingError("Horaires attendus en minutes entières.", 400, "INVALID_MINUTES");
    }
    if (startMin < 0 || endMin > MINUTES_PER_DAY || endMin <= startMin) {
      throw new BookingError("Plage horaire invalide.", 400, "INVALID_RANGE");
    }

    return {
      weekday,
      startMin,
      endMin,
      label: raw.label ? String(raw.label).slice(0, 60) : null,
    };
  });

  assertNoOverlap(slots, field);
  return slots;
}

const DAY_LABELS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** `545` → « 09h05 ». Pour une erreur qui se lit sans conversion mentale. */
function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}h${String(min % 60).padStart(2, "0")}`;
}

/**
 * Refuse deux plages qui se recouvrent le même jour.
 *
 * « 09:00–13:00 » puis « 12:00–18:00 » saisis pour le mardi ne sont pas une
 * journée continue : le moteur génère les créneaux plage par plage, il
 * proposerait donc deux fois 12h15. Le rendez-vous en double serait ensuite
 * refusé par la contrainte d'exclusion PostgreSQL — c'est-à-dire au pire
 * moment, devant le client. Autant le dire ici, où la correction coûte un
 * clic.
 *
 * Deux plages qui se touchent (13:00 puis 13:00) sont acceptées : c'est une
 * journée continue saisie en deux fois, pas un conflit.
 */
function assertNoOverlap(slots: { weekday: number; startMin: number; endMin: number }[], field: string) {
  const byDay = new Map<number, { startMin: number; endMin: number }[]>();
  for (const slot of slots) {
    const day = byDay.get(slot.weekday) ?? [];
    day.push(slot);
    byDay.set(slot.weekday, day);
  }

  const what = field === "breaks" ? "pauses" : "plages horaires";

  for (const [weekday, day] of byDay) {
    const sorted = [...day].sort((a, b) => a.startMin - b.startMin);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startMin < sorted[i - 1].endMin) {
        throw new BookingError(
          `Deux ${what} se chevauchent le ${DAY_LABELS[weekday]} : ` +
            `${hhmm(sorted[i - 1].startMin)}–${hhmm(sorted[i - 1].endMin)} et ` +
            `${hhmm(sorted[i].startMin)}–${hhmm(sorted[i].endMin)}.`,
          409,
          "OVERLAPPING_SCHEDULE",
        );
      }
    }
  }
}

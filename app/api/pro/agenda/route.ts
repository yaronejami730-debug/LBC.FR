import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingError } from "@/lib/booking/engine";
import { bookingErrorResponse, requireProProfile } from "@/lib/booking/http";
import { dayKey, formatMinutes, instantFromLocal, isDayKey, minutesOfDay, MINUTES_PER_DAY, daysBetweenKeys } from "@/lib/booking/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Un agenda annuel en une requête n'a pas d'usage : vue mois au maximum. */
const MAX_RANGE_DAYS = 62;

/**
 * Agenda du professionnel connecté.
 *
 * `?from=2026-08-11&to=2026-08-17` — alimente les vues jour, semaine et mois
 * du dashboard web comme de l'écran mobile. Les rendez-vous annulés sont
 * renvoyés aussi : un agenda qui les masque donne l'impression d'un trou
 * inexpliqué quand le client rappelle.
 */
export async function GET(req: NextRequest) {
  try {
    const { profile } = await requireProProfile(req);

    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? dayKey(new Date());
    const to = url.searchParams.get("to") ?? from;
    if (!isDayKey(from) || !isDayKey(to)) {
      throw new BookingError("`from` et `to` attendus au format YYYY-MM-DD.", 400, "INVALID_DAY");
    }
    const span = daysBetweenKeys(from, to);
    if (span < 0) throw new BookingError("Plage de dates inversée.", 400, "INVALID_RANGE");
    if (span > MAX_RANGE_DAYS) {
      throw new BookingError(`Plage limitée à ${MAX_RANGE_DAYS} jours.`, 400, "RANGE_TOO_WIDE");
    }

    const windowStart = instantFromLocal(from, 0);
    const windowEnd = instantFromLocal(to, MINUTES_PER_DAY);

    const [bookings, timeOff, members] = await Promise.all([
      prisma.proBooking.findMany({
        where: { profileId: profile.id, startAt: { lt: windowEnd }, endAt: { gt: windowStart } },
        orderBy: { startAt: "asc" },
        include: { member: { select: { id: true, displayName: true, color: true } } },
      }),
      prisma.proTimeOff.findMany({
        where: {
          member: { profileId: profile.id },
          startAt: { lt: windowEnd },
          endAt: { gt: windowStart },
        },
      }),
      prisma.proMember.findMany({
        where: { profileId: profile.id, isActive: true },
        orderBy: { position: "asc" },
        select: { id: true, displayName: true, color: true, role: true },
      }),
    ]);

    // Prestations réservables, pour le formulaire d'ajout manuel. Sans durée
    // ferme, aucun créneau n'est calculable : ces lignes-là n'y figurent pas.
    const services = await prisma.proService.findMany({
      where: { profileId: profile.id, isActive: true, isBookable: true, durationMin: { gt: 0 } },
      orderBy: { position: "asc" },
      select: { id: true, label: true, section: true, durationMin: true, price: true },
    });

    return NextResponse.json(
      {
        from,
        to,
        members,
        services,
        timeOff,
        bookings: bookings.map((b) => ({
          id: b.id,
          status: b.status,
          startAt: b.startAt,
          endAt: b.endAt,
          day: dayKey(b.startAt),
          time: formatMinutes(minutesOfDay(b.startAt)),
          label: b.labelSnapshot,
          durationMin: b.durationSnapshot,
          price: b.priceSnapshot,
          note: b.note,
          member: b.member,
          // Le pro a besoin de joindre son client : ces coordonnées sont
          // celles de son propre rendez-vous, pas un annuaire.
          customer: {
            firstName: b.firstName,
            lastName: b.lastName,
            phone: b.phone,
            email: b.email,
          },
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

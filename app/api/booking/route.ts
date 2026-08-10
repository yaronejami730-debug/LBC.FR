import { NextResponse, type NextRequest } from "next/server";
import { getAuthUserId } from "@/lib/auth-unified";
import { createBooking } from "@/lib/booking/book";
import { ANY_MEMBER, BookingError } from "@/lib/booking/engine";
import { bookingErrorResponse } from "@/lib/booking/http";
import { emit } from "@/lib/booking/notify";
import { dayKey, formatMinutes, minutesOfDay } from "@/lib/booking/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Crée un rendez-vous.
 *
 * Même route pour le web et le mobile : `getAuthUserId` accepte le cookie
 * NextAuth comme le Bearer JWT. La réservation reste possible sans compte —
 * `customerId` est alors nul et les coordonnées vivent sur la ligne.
 *
 * La disponibilité n'est jamais présumée depuis la requête : le créneau est
 * recalculé ici, et la base refuse le chevauchement en dernier recours.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new BookingError("Corps de requête invalide.", 400, "INVALID_BODY");

    const serviceId = String(body.serviceId ?? "");
    const memberId = String(body.memberId ?? ANY_MEMBER) || ANY_MEMBER;
    const day = String(body.day ?? "");
    const startMin = Number(body.startMin);
    const contact = (body.contact ?? {}) as Record<string, string>;

    if (!serviceId) throw new BookingError("`serviceId` requis.", 400, "MISSING_SERVICE");

    // Un client connecté ne saisit pas l'identité de quelqu'un d'autre : on
    // rattache la réservation à son compte, mais les coordonnées du formulaire
    // font foi (on réserve souvent pour un proche).
    const customerId = await getAuthUserId(req);

    const booking = await createBooking({
      serviceId,
      memberId,
      day,
      startMin,
      customerId,
      contact: {
        firstName: String(contact.firstName ?? ""),
        lastName: String(contact.lastName ?? ""),
        phone: String(contact.phone ?? ""),
        email: String(contact.email ?? ""),
        note: contact.note ? String(contact.note) : null,
      },
    });

    await emit({
      type: booking.status === "CONFIRMED" ? "booking.confirmed" : "booking.created",
      bookingId: booking.id,
      profileId: booking.profileId,
      customerEmail: booking.email,
      customerId: booking.customerId,
    });

    return NextResponse.json(
      {
        booking: {
          id: booking.id,
          status: booking.status,
          startAt: booking.startAt,
          endAt: booking.endAt,
          // Heure de Paris : `startAt` est un instant, l'afficher dans le
          // fuseau du serveur donnerait une heure fausse en production.
          time: formatMinutes(minutesOfDay(booking.startAt)),
          day: dayKey(booking.startAt),
          service: { id: booking.serviceId, label: booking.labelSnapshot },
          durationMin: booking.durationSnapshot,
          price: booking.priceSnapshot,
          member: { id: booking.memberId, displayName: booking.member.displayName },
          profile: { id: booking.profileId, name: booking.profile.name, slug: booking.profile.slug },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

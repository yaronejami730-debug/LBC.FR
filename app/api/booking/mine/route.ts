import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";
import { bookingErrorResponse } from "@/lib/booking/http";
import { dayKey, formatMinutes, minutesOfDay } from "@/lib/booking/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rendez-vous du client connecté.
 *
 * `?scope=upcoming` (défaut) ou `past`. Les réservations prises sans compte ne
 * remontent pas ici : elles n'ont pas de `customerId`, et rattacher par email
 * laisserait n'importe qui lire l'agenda d'un homonyme en changeant son
 * adresse.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

    const scope = new URL(req.url).searchParams.get("scope") === "past" ? "past" : "upcoming";
    const now = new Date();

    const bookings = await prisma.proBooking.findMany({
      where: {
        customerId: userId,
        ...(scope === "past" ? { startAt: { lt: now } } : { startAt: { gte: now } }),
      },
      orderBy: { startAt: scope === "past" ? "desc" : "asc" },
      take: 100,
      include: {
        member: { select: { id: true, displayName: true } },
        profile: { select: { id: true, name: true, slug: true, city: true, addressLine: true, phone: true } },
      },
    });

    return NextResponse.json(
      { scope, bookings: bookings.map(serializeBooking) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

type BookingRow = Awaited<ReturnType<typeof prisma.proBooking.findMany>>[number] & {
  member?: { id: string; displayName: string };
  profile?: { id: string; name: string; slug: string; city: string | null; addressLine: string | null; phone: string | null };
};

// Non exportée : Next 15 n'autorise que ses propres exports dans un fichier de
// route (GET, POST, dynamic…). Exporter un utilitaire ici casse le build.
function serializeBooking(booking: BookingRow) {
  return {
    id: booking.id,
    status: booking.status,
    startAt: booking.startAt,
    endAt: booking.endAt,
    day: dayKey(booking.startAt),
    time: formatMinutes(minutesOfDay(booking.startAt)),
    label: booking.labelSnapshot,
    durationMin: booking.durationSnapshot,
    price: booking.priceSnapshot,
    note: booking.note,
    member: booking.member ?? null,
    profile: booking.profile ?? null,
  };
}

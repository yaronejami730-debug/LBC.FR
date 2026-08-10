import { NextResponse } from "next/server";
import { ANY_MEMBER, BookingError, getSlots } from "@/lib/booking/engine";
import { bookingErrorResponse } from "@/lib/booking/http";
import { isDayKey } from "@/lib/booking/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Créneaux réservables d'une journée.
 *
 * `?serviceId=…&day=2026-08-11&memberId=any`
 *
 * Public : consulter des disponibilités ne demande pas de compte, on ne
 * réserve pas encore. Chaque créneau renvoie le membre qui l'assurera, y
 * compris en mode « peu importe » — le client choisit une heure, jamais un
 * planning orphelin.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const serviceId = url.searchParams.get("serviceId") ?? "";
    const day = url.searchParams.get("day") ?? "";
    const memberId = url.searchParams.get("memberId") || ANY_MEMBER;

    if (!serviceId) throw new BookingError("`serviceId` requis.", 400, "MISSING_SERVICE");
    if (!isDayKey(day)) throw new BookingError("`day` attendu au format YYYY-MM-DD.", 400, "INVALID_DAY");

    const result = await getSlots({ serviceId, memberId, day });

    return NextResponse.json(result, {
      // Les créneaux bougent à chaque réservation : jamais de cache partagé.
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

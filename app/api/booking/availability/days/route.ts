import { NextResponse } from "next/server";
import { ANY_MEMBER, BookingError, getOpenDays } from "@/lib/booking/engine";
import { bookingErrorResponse } from "@/lib/booking/http";
import { isDayKey } from "@/lib/booking/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Jours comportant au moins un créneau, pour griser le calendrier.
 *
 * `?serviceId=…&from=2026-08-11&to=2026-09-11&memberId=any`
 *
 * Le calcul est le même que celui des créneaux : une journée pleine ressort
 * fermée. Se contenter des horaires d'ouverture ferait cliquer le client sur
 * un jour qu'il découvrirait vide.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const serviceId = url.searchParams.get("serviceId") ?? "";
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const memberId = url.searchParams.get("memberId") || ANY_MEMBER;

    if (!serviceId) throw new BookingError("`serviceId` requis.", 400, "MISSING_SERVICE");
    if (!isDayKey(from) || !isDayKey(to)) {
      throw new BookingError("`from` et `to` attendus au format YYYY-MM-DD.", 400, "INVALID_DAY");
    }

    const result = await getOpenDays({ serviceId, memberId, from, to });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

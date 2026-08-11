import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { bookingErrorResponse, requireProProfile } from "@/lib/booking/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Réservations de l'établissement courant, pour le rafraîchissement continu.
 *
 * L'écran « Mes réservations » interroge cette route en boucle plutôt que
 * d'ouvrir un flux poussé : les fonctions sont sans état partagé, une
 * connexion SSE ouverte sur une instance ne verrait pas la réservation créée
 * par une autre. Un sondage court est ici plus honnête qu'un temps réel qui
 * ne marcherait qu'en développement — et suffit largement : ce qu'on veut,
 * c'est qu'une demande apparaisse sans que personne ne recharge la page.
 *
 * `?since=<ISO>` réduit la réponse aux lignes touchées depuis le dernier
 * passage. La page garde le reste, on ne renvoie pas trois mois d'historique
 * toutes les dix secondes.
 */
export async function GET(req: NextRequest) {
  try {
    const { profile } = await requireProProfile(req, "bookings");

    const sinceRaw = new URL(req.url).searchParams.get("since");
    const since = sinceRaw ? new Date(sinceRaw) : null;
    const validSince = since && !Number.isNaN(since.getTime()) ? since : null;

    const horizon = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const bookings = await prisma.proBooking.findMany({
      where: {
        profileId: profile.id,
        startAt: { gte: horizon },
        ...(validSince ? { updatedAt: { gt: validSince } } : {}),
      },
      orderBy: { startAt: "asc" },
      include: { member: { select: { displayName: true, color: true } } },
    });

    return NextResponse.json({
      // L'horloge du serveur fait foi : celle du navigateur peut dériver, et
      // une seconde d'avance ici ferait manquer une réservation au passage
      // suivant.
      now: new Date().toISOString(),
      bookings: bookings.map((b) => ({
        id: b.id,
        status: b.status,
        source: b.source,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        label: b.labelSnapshot,
        price: b.priceSnapshot,
        firstName: b.firstName,
        lastName: b.lastName,
        phone: b.phone,
        email: b.email,
        note: b.note,
        memberName: b.member?.displayName ?? null,
        memberColor: b.member?.color ?? null,
        cancelReason: b.cancelReason,
      })),
    });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

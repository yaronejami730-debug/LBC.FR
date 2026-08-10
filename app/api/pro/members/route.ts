import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingError } from "@/lib/booking/engine";
import { bookingErrorResponse, requireProProfile } from "@/lib/booking/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Au-delà, ce n'est plus une équipe mais une erreur de saisie. */
const MAX_MEMBERS = 60;

/** Équipe de l'établissement, avec les prestations que chacun assure. */
export async function GET(req: NextRequest) {
  try {
    const { profile } = await requireProProfile(req, "staff");
    const members = await prisma.proMember.findMany({
      where: { profileId: profile.id },
      orderBy: { position: "asc" },
      include: { services: { select: { serviceId: true } } },
    });
    return NextResponse.json({
      members: members.map((m) => ({ ...m, serviceIds: m.services.map((s) => s.serviceId) })),
    });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

/**
 * Ajoute un membre.
 *
 * Il arrive sans horaires : tant que `ProWorkingHours` est vide, le moteur ne
 * lui trouve aucun créneau. C'est le bon défaut — mieux vaut un planning vide
 * qu'une disponibilité inventée.
 */
export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireProProfile(req, "staff");

    const count = await prisma.proMember.count({ where: { profileId: profile.id } });
    if (count >= MAX_MEMBERS) {
      throw new BookingError(`Maximum ${MAX_MEMBERS} membres.`, 409, "TOO_MANY_MEMBERS");
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const displayName = String(body.displayName ?? "").trim();
    if (!displayName) throw new BookingError("Le nom est requis.", 400, "MISSING_NAME");

    const member = await prisma.proMember.create({
      data: {
        profileId: profile.id,
        displayName: displayName.slice(0, 80),
        role: body.role ? String(body.role).slice(0, 80) : null,
        avatar: body.avatar ? String(body.avatar) : null,
        color: body.color ? String(body.color).slice(0, 9) : undefined,
        position: count,
        // Rattachement explicite à l'établissement courant. Un membre pourra
        // en couvrir plusieurs sans être dupliqué — le dupliquer casserait la
        // contrainte anti-double-booking, qui porte sur `memberId`.
        establishments: { create: { profileId: profile.id } },
      },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

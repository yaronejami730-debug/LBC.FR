import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingError } from "@/lib/booking/engine";
import { bookingErrorResponse, requireProProfile } from "@/lib/booking/http";
import { memberDisplayName } from "@/lib/pro-member-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Au-delà, ce n'est plus une équipe mais une erreur de saisie. */
const MAX_MEMBERS = 60;

/** Équipe de l'établissement, avec les prestations que chacun assure. */
export async function GET(req: NextRequest) {
  try {
    const { profile } = await requireProProfile(req, "staff");
    const members = await prisma.proMember.findMany({
      // Ceux d'ici, plus ceux que le groupe y détache : une personne partagée
      // entre deux boutiques doit apparaître dans les deux équipes.
      where: {
        OR: [{ profileId: profile.id }, { establishments: { some: { profileId: profile.id } } }],
      },
      orderBy: { position: "asc" },
      include: {
        services: { select: { serviceId: true } },
        establishments: { select: { profileId: true } },
      },
    });
    return NextResponse.json({
      members: members.map((m) => ({
        ...m,
        serviceIds: m.services.map((s) => s.serviceId),
        // Établissement d'origine compris : c'est la liste des lieux où la
        // personne travaille, telle que l'interface la coche.
        establishmentIds: [m.profileId, ...m.establishments.map((e) => e.profileId)],
        homeProfileId: m.profileId,
      })),
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
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    // `displayName` reste accepté tel quel s'il est fourni — l'application
    // mobile et les intégrations existantes n'envoient que lui.
    const explicit = String(body.displayName ?? "").trim();
    const displayName = explicit || memberDisplayName(firstName, lastName);
    if (!displayName) throw new BookingError("Le prénom est requis.", 400, "MISSING_NAME");

    const member = await prisma.proMember.create({
      data: {
        profileId: profile.id,
        firstName: firstName.slice(0, 80) || null,
        lastName: lastName.slice(0, 80) || null,
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

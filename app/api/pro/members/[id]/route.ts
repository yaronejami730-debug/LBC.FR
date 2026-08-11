import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingError } from "@/lib/booking/engine";
import { bookingErrorResponse, requireOwnedMember, requireProProfile } from "@/lib/booking/http";
import { OCCUPYING_STATUSES } from "@/lib/booking/status";
import { memberDisplayName } from "@/lib/pro-member-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Modifie un membre : nom, rôle, couleur, ordre, activation. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { profile } = await requireProProfile(req, "staff");
    const current = await requireOwnedMember(profile.id, id);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // Le libellé public suit le prénom tant que la responsable ne l'a pas
    // réécrit à la main : renommer « Corinne » en « Corine » ne doit pas
    // obliger à corriger deux champs, et un libellé personnalisé (« Corinne D. »
    // pour la distinguer de sa collègue) ne doit pas être écrasé.
    const renamed =
      body.firstName !== undefined || body.lastName !== undefined
        ? memberDisplayName(
            String(body.firstName ?? current.firstName ?? ""),
            String(body.lastName ?? current.lastName ?? ""),
          )
        : null;

    const member = await prisma.proMember.update({
      where: { id },
      data: {
        ...(body.firstName !== undefined
          ? { firstName: String(body.firstName).trim().slice(0, 80) || null }
          : {}),
        ...(body.lastName !== undefined
          ? { lastName: String(body.lastName).trim().slice(0, 80) || null }
          : {}),
        ...(body.displayName !== undefined
          ? { displayName: String(body.displayName).trim().slice(0, 80) }
          : renamed
            ? { displayName: renamed }
            : {}),
        ...(body.role !== undefined ? { role: body.role ? String(body.role).slice(0, 80) : null } : {}),
        ...(body.avatar !== undefined ? { avatar: body.avatar ? String(body.avatar) : null } : {}),
        ...(body.color !== undefined ? { color: String(body.color).slice(0, 9) } : {}),
        ...(body.position !== undefined ? { position: Number(body.position) || 0 } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
      },
    });

    return NextResponse.json({ member });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

/**
 * Retire un membre de l'équipe.
 *
 * Refusé tant qu'il lui reste des rendez-vous à venir : la base l'interdirait
 * de toute façon (clé étrangère RESTRICT), autant l'expliquer clairement.
 * Pour masquer quelqu'un sans toucher à son historique, `isActive: false`
 * suffit — il disparaît des propositions et garde ses rendez-vous.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { profile } = await requireProProfile(req, "staff");
    await requireOwnedMember(profile.id, id);

    const pending = await prisma.proBooking.count({
      where: { memberId: id, status: { in: [...OCCUPYING_STATUSES] }, startAt: { gte: new Date() } },
    });
    if (pending > 0) {
      throw new BookingError(
        `${pending} rendez-vous à venir sont attribués à ce membre. Annulez-les ou désactivez le membre.`,
        409,
        "MEMBER_HAS_BOOKINGS",
      );
    }

    const past = await prisma.proBooking.count({ where: { memberId: id } });
    if (past > 0) {
      // Historique conservé : on désactive au lieu de supprimer, sinon on perd
      // la trace de rendez-vous passés qui peuvent être contestés.
      const member = await prisma.proMember.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ member, deactivated: true });
    }

    await prisma.proMember.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

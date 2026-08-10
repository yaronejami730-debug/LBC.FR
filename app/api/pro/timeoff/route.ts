import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingError } from "@/lib/booking/engine";
import { bookingErrorResponse, requireOwnedMember, requireProProfile } from "@/lib/booking/http";
import { OCCUPYING_STATUSES } from "@/lib/booking/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Absences à venir de l'équipe. */
export async function GET(req: NextRequest) {
  try {
    const { profile } = await requireProProfile(req);
    const timeOff = await prisma.proTimeOff.findMany({
      where: { member: { profileId: profile.id }, endAt: { gte: new Date() } },
      orderBy: { startAt: "asc" },
      include: { member: { select: { id: true, displayName: true } } },
    });
    return NextResponse.json({ timeOff });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

/**
 * Pose une absence.
 *
 * L'absence n'annule pas les rendez-vous déjà pris — le pro doit décider quoi
 * en faire, un congé posé par erreur ne doit pas vider un agenda. On les
 * signale dans la réponse pour qu'il les traite en connaissance de cause.
 */
export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireProProfile(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const memberId = String(body.memberId ?? "");
    await requireOwnedMember(profile.id, memberId);

    const startAt = new Date(String(body.startAt ?? ""));
    const endAt = new Date(String(body.endAt ?? ""));
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BookingError("Dates invalides.", 400, "INVALID_DATES");
    }
    if (endAt <= startAt) {
      throw new BookingError("La fin doit suivre le début.", 400, "INVALID_RANGE");
    }

    const conflicting = await prisma.proBooking.count({
      where: {
        memberId,
        status: { in: [...OCCUPYING_STATUSES] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });

    const timeOff = await prisma.proTimeOff.create({
      data: {
        memberId,
        startAt,
        endAt,
        reason: body.reason ? String(body.reason).slice(0, 200) : null,
      },
    });

    return NextResponse.json({ timeOff, conflictingBookings: conflicting }, { status: 201 });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

/** Supprime une absence. `?id=…` */
export async function DELETE(req: NextRequest) {
  try {
    const { profile } = await requireProProfile(req);
    const id = new URL(req.url).searchParams.get("id") ?? "";

    const existing = await prisma.proTimeOff.findUnique({
      where: { id },
      include: { member: { select: { profileId: true } } },
    });
    if (!existing || existing.member.profileId !== profile.id) {
      throw new BookingError("Absence introuvable.", 404, "TIMEOFF_NOT_FOUND");
    }

    await prisma.proTimeOff.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

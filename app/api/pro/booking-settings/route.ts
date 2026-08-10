import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingError } from "@/lib/booking/engine";
import { bookingErrorResponse, requireProProfile } from "@/lib/booking/http";
import { loadBookingPolicy } from "@/lib/booking/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Règles de réservation de l'établissement (valeurs par défaut si jamais réglées). */
export async function GET(req: NextRequest) {
  try {
    const { profile } = await requireProProfile(req);
    const settings = await loadBookingPolicy(profile.id);
    return NextResponse.json({ settings });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

/**
 * Enregistre les règles.
 *
 * Chaque valeur est bornée : un pas de créneau à 0 min ferait boucler le
 * moteur, un horizon à 10 ans ferait calculer 3 650 journées à chaque
 * ouverture du calendrier. Ce sont des réglages, pas des armes.
 */
export async function PUT(req: NextRequest) {
  try {
    const { profile } = await requireProProfile(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const data = {
      slotGranularityMin: clamp(body.slotGranularityMin, 5, 120, 15),
      bufferMin: clamp(body.bufferMin, 0, 120, 0),
      minNoticeMin: clamp(body.minNoticeMin, 0, 60 * 24 * 30, 120),
      maxAdvanceDays: clamp(body.maxAdvanceDays, 1, 365, 60),
      cancelDeadlineMin: clamp(body.cancelDeadlineMin, 0, 60 * 24 * 30, 1440),
      autoConfirm: body.autoConfirm === undefined ? true : Boolean(body.autoConfirm),
      allowCancel: body.allowCancel === undefined ? true : Boolean(body.allowCancel),
      allowReschedule: body.allowReschedule === undefined ? true : Boolean(body.allowReschedule),
    };

    const settings = await prisma.proBookingSettings.upsert({
      where: { profileId: profile.id },
      create: { profileId: profile.id, ...data },
      update: data,
    });

    return NextResponse.json({ settings });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new BookingError("Valeur numérique attendue.", 400, "INVALID_SETTING");
  return Math.min(max, Math.max(min, Math.round(n)));
}

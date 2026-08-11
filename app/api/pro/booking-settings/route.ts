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
    const { profile } = await requireProProfile(req, "bookings");
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
    const { profile } = await requireProProfile(req, "bookings");
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    /**
     * Mise à jour partielle.
     *
     * Un corps qui ne porte qu'`autoConfirm` — c'est le cas du basculement
     * depuis « Mes réservations » — ne doit pas ramener le pas de créneau, le
     * battement et le délai d'annulation à leurs valeurs d'usine. On part donc
     * des réglages existants, pas des valeurs par défaut, et on n'écrase que
     * ce qui est effectivement transmis.
     */
    const existing = await prisma.proBookingSettings.findUnique({
      where: { profileId: profile.id },
    });

    const num = (key: keyof typeof RANGES, current: number | undefined) =>
      body[key] === undefined
        ? (current ?? RANGES[key][2])
        : clamp(body[key], RANGES[key][0], RANGES[key][1], RANGES[key][2]);

    const bool = (key: string, current: boolean | undefined) =>
      body[key] === undefined ? (current ?? true) : Boolean(body[key]);

    const data = {
      slotGranularityMin: num("slotGranularityMin", existing?.slotGranularityMin),
      bufferMin: num("bufferMin", existing?.bufferMin),
      minNoticeMin: num("minNoticeMin", existing?.minNoticeMin),
      maxAdvanceDays: num("maxAdvanceDays", existing?.maxAdvanceDays),
      cancelDeadlineMin: num("cancelDeadlineMin", existing?.cancelDeadlineMin),
      autoConfirm: bool("autoConfirm", existing?.autoConfirm),
      allowCancel: bool("allowCancel", existing?.allowCancel),
      allowReschedule: bool("allowReschedule", existing?.allowReschedule),
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

/** Bornes et valeur par défaut de chaque réglage numérique : [min, max, défaut]. */
const RANGES = {
  slotGranularityMin: [5, 120, 15],
  bufferMin: [0, 120, 0],
  minNoticeMin: [0, 60 * 24 * 30, 120],
  maxAdvanceDays: [1, 365, 60],
  cancelDeadlineMin: [0, 60 * 24 * 30, 1440],
} as const;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new BookingError("Valeur numérique attendue.", 400, "INVALID_SETTING");
  return Math.min(max, Math.max(min, Math.round(n)));
}

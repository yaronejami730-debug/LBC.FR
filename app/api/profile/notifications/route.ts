import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";
import { invalidatePreferencesCache } from "@/lib/notifications/preferences";

export const dynamic = "force-dynamic";

export type NotifChannel = "push" | "email";
export type NotifEvent =
  | "messages"
  | "favorites"
  | "listingPublished"
  | "listingExpiring"
  | "newsletter"
  | "personalized"
  | "partners";

export type NotificationPreferences = Partial<Record<NotifEvent, Partial<Record<NotifChannel, boolean>>>>;

const DEFAULTS: NotificationPreferences = {
  messages: { push: true, email: true },
  favorites: { push: true, email: true },
  listingPublished: { push: true },
  listingExpiring: { push: true },
  newsletter: { push: true, email: true },
  personalized: { push: true, email: true },
  partners: { email: false },
};

function sanitize(input: unknown): NotificationPreferences {
  if (!input || typeof input !== "object") return {};
  const obj = input as Record<string, unknown>;
  const out: NotificationPreferences = {};
  const events: NotifEvent[] = ["messages", "favorites", "listingPublished", "listingExpiring", "newsletter", "personalized", "partners"];
  const channels: NotifChannel[] = ["push", "email"];
  for (const ev of events) {
    const v = obj[ev];
    if (!v || typeof v !== "object") continue;
    const evObj = v as Record<string, unknown>;
    const cleaned: Partial<Record<NotifChannel, boolean>> = {};
    for (const ch of channels) {
      if (typeof evObj[ch] === "boolean") cleaned[ch] = evObj[ch] as boolean;
    }
    if (Object.keys(cleaned).length > 0) out[ev] = cleaned;
  }
  return out;
}

function withDefaults(stored: NotificationPreferences): NotificationPreferences {
  const merged: NotificationPreferences = {};
  for (const ev of Object.keys(DEFAULTS) as NotifEvent[]) {
    merged[ev] = { ...DEFAULTS[ev], ...(stored[ev] || {}) };
  }
  return merged;
}

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPreferences: true },
  });
  const stored = sanitize(user?.notificationPreferences);
  return NextResponse.json({ preferences: withDefaults(stored) });
}

export async function PATCH(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Body invalide" }, { status: 400 });

  const incoming = sanitize(body.preferences ?? body);

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPreferences: true },
  });
  const merged = { ...sanitize(current?.notificationPreferences), ...incoming };

  await prisma.user.update({
    where: { id: userId },
    data: { notificationPreferences: merged },
  });
  invalidatePreferencesCache(userId);

  return NextResponse.json({ preferences: withDefaults(merged) });
}

/**
 * Préférences notifications par utilisateur, avec respect des défauts.
 *
 * - GET/PATCH UI: `app/api/profile/notifications/route.ts`
 * - Schéma JSON: `User.notificationPreferences` (Json?)
 * - Tout est activé par défaut, sauf `partners.email`.
 * - Les codes "événement" (messages, favorites, listingPublished, etc.) sont
 *   stables et utilisés à la fois par l'UI mobile et le backend.
 */

import { prisma } from "@/lib/prisma";
import type { NotificationType } from "./templates";

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

export const DEFAULT_PREFERENCES: Record<NotifEvent, Record<NotifChannel, boolean>> = {
  messages: { push: true, email: true },
  favorites: { push: true, email: true },
  listingPublished: { push: true, email: true },
  listingExpiring: { push: true, email: true },
  newsletter: { push: true, email: true },
  personalized: { push: true, email: true },
  partners: { push: false, email: false },
};

/** Mappe un type de template vers un événement de préférences. */
export function templateToEvent(type: NotificationType): NotifEvent | null {
  switch (type) {
    case "new_message":
    case "listing_message":
    case "message_seen":
      return "messages";

    case "listing_favorited":
    case "listing_trending":
      return "favorites";

    case "listing_approved":
    case "listing_rejected":
    case "listing_pending":
    case "listing_suspended":
      return "listingPublished";

    case "listing_expired":
    case "listing_expiring":
      return "listingExpiring";

    case "saved_alert_match":
    case "multiple_alert_matches":
    case "user_comeback":
    case "first_listing":
    case "complete_profile":
      return "personalized";

    case "boost_discount":
      return "partners";

    // Sécurité / paiement / onboarding (welcome, email_verified, password_changed, etc.)
    // → toujours envoyés, non couverts par les préférences.
    case "password_changed":
    case "suspicious_login":
    case "email_verified":
    case "welcome":
    case "payment_success":
    case "payment_failed":
    case "boost_enabled":
    case "new_review":
    case "badge_earned":
      return null;

    default:
      return null;
  }
}

function sanitize(raw: unknown): NotificationPreferences {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const events: NotifEvent[] = ["messages", "favorites", "listingPublished", "listingExpiring", "newsletter", "personalized", "partners"];
  const channels: NotifChannel[] = ["push", "email"];
  const out: NotificationPreferences = {};
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

const cache = new Map<string, { at: number; prefs: NotificationPreferences }>();
const TTL_MS = 60_000;

async function getStoredPreferences(userId: string): Promise<NotificationPreferences> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.prefs;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPreferences: true },
  });
  const prefs = sanitize(user?.notificationPreferences);
  cache.set(userId, { at: Date.now(), prefs });
  return prefs;
}

/** Vide le cache pour un user (à appeler après PATCH prefs). */
export function invalidatePreferencesCache(userId: string): void {
  cache.delete(userId);
}

export async function isChannelAllowed(
  userId: string,
  event: NotifEvent,
  channel: NotifChannel,
): Promise<boolean> {
  const stored = await getStoredPreferences(userId);
  const v = stored[event]?.[channel];
  if (typeof v === "boolean") return v;
  return DEFAULT_PREFERENCES[event][channel];
}

export async function isPushAllowed(userId: string, event: NotifEvent): Promise<boolean> {
  return isChannelAllowed(userId, event, "push");
}

export async function isEmailAllowed(userId: string, event: NotifEvent): Promise<boolean> {
  return isChannelAllowed(userId, event, "email");
}

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Journal des appareils connectés à un compte.
 *
 * La table `DeviceSession` existait mais n'était jamais écrite : seuls les
 * jetons push mobiles remontaient dans « Appareils connectés », et un
 * ordinateur connecté restait invisible. On enregistre donc une entrée à
 * chaque connexion, rafraîchie ensuite par l'activité.
 *
 * IP et User-Agent ne sont conservés que hachés — ils servent à reconnaître un
 * appareil déjà vu et à la détection de fraude, pas à tracer quelqu'un. Le
 * libellé lisible (« Chrome sur macOS ») est dérivé du User-Agent puis le
 * User-Agent brut est jeté.
 */

const TOUCH_INTERVAL_MS = 15 * 60 * 1000;

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

/** Première IP de la chaîne de proxies — la seule qui désigne le client. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

/**
 * Libellé lisible tiré du User-Agent. Volontairement grossier : distinguer
 * « Safari sur iPhone » de « Chrome sur Windows » suffit à reconnaître ses
 * propres appareils, et une analyse plus fine reviendrait à du fingerprinting.
 */
export function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Navigateur inconnu";
  const ua = userAgent.toLowerCase();

  const os = ua.includes("iphone")
    ? "iPhone"
    : ua.includes("ipad")
      ? "iPad"
      : ua.includes("android")
        ? "Android"
        : ua.includes("mac os") || ua.includes("macintosh")
          ? "macOS"
          : ua.includes("windows")
            ? "Windows"
            : ua.includes("linux")
              ? "Linux"
              : null;

  // Ordre important : Edge et Opera se déclarent aussi « Chrome », Chrome se
  // déclare aussi « Safari ».
  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("opr/") || ua.includes("opera")
      ? "Opera"
      : ua.includes("firefox")
        ? "Firefox"
        : ua.includes("chrome") || ua.includes("crios")
          ? "Chrome"
          : ua.includes("safari")
            ? "Safari"
            : null;

  if (browser && os) return `${browser} sur ${os}`;
  if (browser) return browser;
  if (os) return os;
  return "Navigateur inconnu";
}

type RecordInput = {
  userId: string;
  headers: Headers;
  /** Renseigné pour une connexion applicative ; sinon on déduit du navigateur. */
  label?: string;
};

/**
 * Enregistre ou rafraîchit l'appareil courant. Un même couple IP/User-Agent
 * est réutilisé plutôt que dupliqué, sinon la liste se remplirait d'une entrée
 * par connexion.
 *
 * Ne lève jamais : un échec d'écriture ne doit pas casser une connexion.
 */
export async function recordDeviceSession({ userId, headers, label }: RecordInput): Promise<void> {
  try {
    const userAgent = headers.get("user-agent");
    const ipHash = hash(clientIp(headers));
    const uaHash = hash(userAgent ?? "unknown");

    const existing = await prisma.deviceSession.findFirst({
      where: { userId, ipHash, uaHash },
      select: { id: true },
    });

    if (existing) {
      await prisma.deviceSession.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), deviceName: label ?? deviceLabel(userAgent) },
      });
      return;
    }

    await prisma.deviceSession.create({
      data: { userId, ipHash, uaHash, deviceName: label ?? deviceLabel(userAgent) },
    });
  } catch {
    /* jamais bloquant */
  }
}

/**
 * Rafraîchit `lastSeenAt` depuis une requête authentifiée ordinaire, au plus
 * une fois par quart d'heure : sans throttle, chaque appel d'API deviendrait
 * une écriture.
 */
export async function touchDeviceSession({ userId, headers }: RecordInput): Promise<void> {
  try {
    const userAgent = headers.get("user-agent");
    const ipHash = hash(clientIp(headers));
    const uaHash = hash(userAgent ?? "unknown");

    const existing = await prisma.deviceSession.findFirst({
      where: { userId, ipHash, uaHash },
      select: { id: true, lastSeenAt: true },
    });
    if (!existing) {
      await recordDeviceSession({ userId, headers });
      return;
    }
    if (Date.now() - existing.lastSeenAt.getTime() < TOUCH_INTERVAL_MS) return;
    await prisma.deviceSession.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
    });
  } catch {
    /* jamais bloquant */
  }
}

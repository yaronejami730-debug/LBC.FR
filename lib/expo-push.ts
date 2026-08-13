import { prisma } from "@/lib/prisma";

export type ExpoPushPayload = {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
};

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

const EXPO_ENDPOINT = "https://exp.host/--/api/v2/push/send";

// Envoie un batch de messages à l'API Expo Push. Désactive automatiquement
// les tokens qui renvoient DeviceNotRegistered / InvalidCredentials.
export async function sendExpoPush(messages: ExpoPushPayload[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    const res = await fetch(EXPO_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.error("[ExpoPush] HTTP", res.status, await res.text().catch(() => ""));
      return;
    }
    const json = (await res.json()) as { data?: ExpoTicket[] };
    const tickets = json.data ?? [];
    const deadTokens: string[] = [];
    tickets.forEach((t, i) => {
      if (t.status === "error") {
        const err = t.details?.error;
        if (err === "DeviceNotRegistered" || err === "InvalidCredentials") {
          deadTokens.push(messages[i].to);
        } else {
          console.error("[ExpoPush] ticket erreur:", err, t.message);
        }
      }
    });
    if (deadTokens.length > 0) {
      await prisma.expoPushToken
        .updateMany({
          where: { token: { in: deadTokens } },
          data: { disabledAt: new Date() },
        })
        .catch(() => {});
    }
  } catch (err) {
    console.error("[ExpoPush] exception:", err);
  }
}

/**
 * Envoie une notification aux appareils d'un utilisateur.
 *
 * Seuls les appareils en mode « utilisateur » sont visés : un administrateur
 * qui a basculé son téléphone en mode administrateur ne veut pas y voir
 * arriver « votre annonce a été mise en favori ». Il la retrouvera en
 * rebasculant — rien n'est perdu, c'est l'aiguillage qui change.
 */
export async function notifyUser(
  userId: string,
  payload: Omit<ExpoPushPayload, "to">,
): Promise<void> {
  const tokens = await prisma.expoPushToken.findMany({
    where: { userId, disabledAt: null, mode: "user" },
    select: { token: true },
  });
  if (tokens.length === 0) return;
  await sendExpoPush(
    tokens.map((t) => ({ ...payload, to: t.token, sound: payload.sound ?? "default" })),
  );
  await prisma.expoPushToken
    .updateMany({
      where: { token: { in: tokens.map((t) => t.token) } },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});
}

/**
 * Alerte de modération, envoyée aux appareils passés en mode administrateur.
 *
 * Personne n'est notifié en double : un administrateur dont le téléphone est
 * resté en mode utilisateur ne reçoit rien ici — c'est le sens du mode. Le
 * rôle est revérifié à l'envoi, un compte rétrogradé depuis l'enregistrement
 * de son jeton ne doit plus rien recevoir.
 */
export async function notifyAdmins(
  payload: Omit<ExpoPushPayload, "to">,
  options?: { exceptUserId?: string },
): Promise<void> {
  const tokens = await prisma.expoPushToken.findMany({
    where: {
      disabledAt: null,
      mode: "admin",
      user: { role: "ADMIN" },
      ...(options?.exceptUserId ? { userId: { not: options.exceptUserId } } : {}),
    },
    select: { token: true },
  });
  if (tokens.length === 0) return;

  await sendExpoPush(
    tokens.map((t) => ({
      ...payload,
      to: t.token,
      sound: payload.sound ?? "default",
      channelId: payload.channelId ?? "admin",
    })),
  );
  await prisma.expoPushToken
    .updateMany({
      where: { token: { in: tokens.map((t) => t.token) } },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});
}

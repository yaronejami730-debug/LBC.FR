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

// Envoie une notification à tous les appareils actifs d'un utilisateur.
export async function notifyUser(
  userId: string,
  payload: Omit<ExpoPushPayload, "to">,
): Promise<void> {
  const tokens = await prisma.expoPushToken.findMany({
    where: { userId, disabledAt: null },
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

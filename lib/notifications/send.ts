import { notifyUser } from "@/lib/expo-push";
import { NOTIFICATION_TEMPLATES, interpolate, type NotificationType } from "./templates";

export type SendNotifInput = {
  userId: string;
  template: NotificationType;
  variables?: Record<string, string | number | undefined>;
};

// Envoie une notification push depuis un template typé.
// Le template définit type / title / body / deepLink avec variables {{var}}.
// data inclut { type, deepLink } + variables brutes (utile pour le routing).
export async function sendPushNotification({ userId, template, variables = {} }: SendNotifInput): Promise<void> {
  const tpl = NOTIFICATION_TEMPLATES[template];
  if (!tpl) {
    console.error("[sendPushNotification] template inconnu:", template);
    return;
  }
  const title = interpolate(tpl.title, variables);
  const body = interpolate(tpl.body, variables);
  const deepLink = tpl.deepLink ? interpolate(tpl.deepLink, variables) : undefined;

  await notifyUser(userId, {
    title,
    body,
    data: {
      type: tpl.type,
      deepLink,
      ...variables,
    },
  });
}

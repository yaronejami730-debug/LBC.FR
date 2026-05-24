import { notifyUser } from "@/lib/expo-push";
import { NOTIFICATION_TEMPLATES, interpolate, type NotificationType } from "./templates";
import { isPushAllowed, templateToEvent } from "./preferences";

export type SendNotifInput = {
  userId: string;
  template: NotificationType;
  variables?: Record<string, string | number | undefined>;
};

// Envoie une notification push depuis un template typé, en respectant les
// préférences utilisateur. Les templates de sécurité/onboarding (templateToEvent
// retourne null) passent toujours.
export async function sendPushNotification({ userId, template, variables = {} }: SendNotifInput): Promise<void> {
  const tpl = NOTIFICATION_TEMPLATES[template];
  if (!tpl) {
    console.error("[sendPushNotification] template inconnu:", template);
    return;
  }

  const event = templateToEvent(template);
  if (event && !(await isPushAllowed(userId, event))) {
    return; // user a désactivé ce type de push
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

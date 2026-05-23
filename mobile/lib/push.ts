import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiFetch } from "./api";

// Affiche les notifs même quand l'app est au premier plan.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  }

  const settings = await Notifications.getPermissionsAsync();
  let granted = settings.status === "granted";
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.status === "granted";
  }
  if (!granted) return null;

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId;

  let tokenString: string;
  try {
    const t = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    tokenString = t.data;
  } catch (e) {
    console.warn("[push] getExpoPushTokenAsync failed:", e);
    return null;
  }

  try {
    await apiFetch("/api/mobile/push/register", {
      method: "POST",
      body: JSON.stringify({
        token: tokenString,
        platform: Platform.OS,
        deviceName: Device.deviceName ?? null,
        appVersion: Constants.expoConfig?.version ?? null,
      }),
    });
  } catch (e) {
    console.warn("[push] register backend failed:", e);
  }

  return tokenString;
}

export async function unregisterExpoPushToken(token: string): Promise<void> {
  if (!token) return;
  try {
    await apiFetch("/api/mobile/push/register", {
      method: "DELETE",
      body: JSON.stringify({ token }),
    });
  } catch {
    // silencieux : le token finira invalide côté serveur lors du prochain envoi
  }
}

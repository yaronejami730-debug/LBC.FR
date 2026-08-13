import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "./api";

/**
 * Dernier jeton Expo obtenu sur cet appareil.
 *
 * Conservé pour pouvoir changer le mode d'un appareil (utilisateur ↔
 * administrateur) sans repasser par la demande de permission : redemander le
 * jeton à chaque bascule ferait clignoter la boîte de dialogue système.
 */
const TOKEN_KEY = "dealandco.push.token";
let cachedToken: string | null = null;

export async function getStoredPushToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  const stored = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  cachedToken = stored;
  return stored;
}

// Affiche les notifs même quand l'app est au premier plan.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
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

  cachedToken = tokenString;
  await AsyncStorage.setItem(TOKEN_KEY, tokenString).catch(() => {});

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

/**
 * Déclare au serveur dans quel mode cet appareil est utilisé.
 *
 * Le jeton Expo ne change pas — c'est l'aiguillage des notifications qui
 * change. Un même compte peut donc avoir son téléphone en mode administrateur
 * et sa tablette en mode utilisateur.
 */
export async function setPushMode(mode: "user" | "admin"): Promise<void> {
  const token = await getStoredPushToken();
  if (!token) return;
  try {
    await apiFetch("/api/mobile/push/register", {
      method: "POST",
      body: JSON.stringify({
        token,
        platform: Platform.OS,
        deviceName: Device.deviceName ?? null,
        appVersion: Constants.expoConfig?.version ?? null,
        mode,
      }),
    });
  } catch (e) {
    console.warn("[push] setPushMode failed:", e);
  }
}

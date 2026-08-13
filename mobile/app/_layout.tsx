import "../global.css";
import { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { AuthProvider } from "@/lib/auth";
import { UnreadProvider } from "@/lib/unread";
import { TaxonomyProvider } from "@/lib/taxonomy";
import { AdminModeProvider } from "@/lib/adminMode";
import { colors } from "@/lib/theme";
import { interFonts, applyInterDefaults } from "@/lib/fonts";

// Garde le splash jusqu'au chargement d'Inter — évite le flash en police système.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Configure handler avant tout — assure que les notifs s'affichent en foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Canal Android requis pour son et heads-up. iOS ignore.
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lightColor: colors.primary,
  }).catch(() => {});

  // Canal distinct pour la modération : un administrateur doit pouvoir couper
  // les alertes d'annonces en attente la nuit sans se couper de ses messages.
  Notifications.setNotificationChannelAsync("admin", {
    name: "Administration",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 200, 150, 200],
    lightColor: colors.primary,
  }).catch(() => {});
}

function NotificationRouter() {
  const router = useRouter();
  const handled = useRef<Set<string>>(new Set());

  const route = useCallback(
    (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handled.current.has(id)) return;
      handled.current.add(id);
      const data = response.notification.request.content.data as Record<string, unknown>;
      // Préfère le deepLink envoyé par le template ; fallback sur type+id legacy.
      const deepLink = typeof data?.deepLink === "string" ? data.deepLink : null;
      if (deepLink) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(deepLink as any);
        return;
      }
      // Alertes de modération : elles ouvrent la file concernée, pas la fiche
      // publique de l'annonce — l'administrateur vient décider, pas acheter.
      if (typeof data?.type === "string" && data.type.startsWith("admin_")) {
        if (data.type === "admin_report") router.push("/admin/signalements");
        else if (data.type === "admin_pro_pending") router.push("/admin/professionnels");
        else router.push("/admin/annonces");
        return;
      }
      if (typeof data?.conversationId === "string") {
        router.push(`/messages/${data.conversationId}`);
      } else if (typeof data?.listingId === "string") {
        router.push(`/annonce/${data.listingId}`);
      }
    },
    [router],
  );

  // Tap pendant que l'app tourne (foreground/background).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(route);
    return () => sub.remove();
  }, [route]);

  // Tap qui a lancé l'app depuis l'état tué (cold start) : le listener ci-dessus
  // ne reçoit pas cette réponse, il faut la récupérer explicitement.
  useEffect(() => {
    let cancelled = false;
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!cancelled) route(response);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [route]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(interFonts);

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    // En cas d'échec de chargement on continue en police système plutôt que
    // de bloquer l'app sur le splash.
    if (fontsLoaded) applyInterDefaults();
    SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <UnreadProvider>
            <TaxonomyProvider>
            <AdminModeProvider>
            <StatusBar style="dark" />
            <NotificationRouter />
            <Stack
              screenOptions={{
                headerShown: false,
                headerBackTitle: "Profil",
                headerTintColor: colors.primary,
                headerTitleStyle: { color: colors.onSurface },
                headerStyle: { backgroundColor: colors.surface },
                contentStyle: { backgroundColor: colors.app },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(auth)" options={{ presentation: "modal" }} />
              <Stack.Screen name="annonce/[id]" options={{ headerShown: true, title: "", headerBackTitle: "Retour" }} />
              <Stack.Screen name="vendeur/[id]" options={{ headerShown: true, title: "Profil vendeur", headerBackTitle: "Retour" }} />
              <Stack.Screen name="messages/[conversationId]" options={{ headerShown: true, title: "Conversation", headerBackTitle: "Retour" }} />
              <Stack.Screen name="settings/informations-personnelles" options={{ headerShown: true, title: "Informations personnelles" }} />
              <Stack.Screen name="settings/email" options={{ headerShown: true, title: "Adresse email" }} />
              <Stack.Screen name="settings/notifications" options={{ headerShown: true, title: "Notifications" }} />
              <Stack.Screen name="settings/securite" options={{ headerShown: true, title: "Sécurité du compte" }} />
              <Stack.Screen name="settings/mot-de-passe" options={{ headerShown: true, title: "Mot de passe" }} />
              <Stack.Screen name="settings/telephone" options={{ headerShown: true, title: "Numéro de téléphone" }} />
              <Stack.Screen name="settings/appareils" options={{ headerShown: true, title: "Appareils connectés" }} />
              <Stack.Screen name="settings/aide" options={{ headerShown: true, title: "Aide" }} />
              <Stack.Screen name="admin" options={{ headerShown: false }} />
            </Stack>
            </AdminModeProvider>
            </TaxonomyProvider>
          </UnreadProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

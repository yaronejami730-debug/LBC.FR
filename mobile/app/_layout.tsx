import "../global.css";
import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import { AuthProvider } from "@/lib/auth";
import { UnreadProvider } from "@/lib/unread";

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
    lightColor: "#2f6fb8",
  }).catch(() => {});
}

function NotificationRouter() {
  const router = useRouter();
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.type === "message" && typeof data.conversationId === "string") {
        router.push(`/messages/${data.conversationId}`);
      } else if (data?.type === "listing" && typeof data.listingId === "string") {
        router.push(`/annonce/${data.listingId}`);
      }
    });
    return () => sub.remove();
  }, [router]);
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <UnreadProvider>
            <StatusBar style="dark" />
            <NotificationRouter />
            <Stack
              screenOptions={{
                headerShown: false,
                headerBackTitle: "Profil",
                headerTintColor: "#2f6fb8",
                headerTitleStyle: { color: "#1a1a1a" },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(auth)" options={{ presentation: "modal" }} />
              <Stack.Screen name="annonce/[id]" options={{ headerShown: true, title: "", headerBackTitle: "Retour" }} />
              <Stack.Screen name="messages/[conversationId]" options={{ headerShown: true, title: "Conversation", headerBackTitle: "Retour" }} />
              <Stack.Screen name="settings/informations-personnelles" options={{ headerShown: true, title: "Informations personnelles" }} />
              <Stack.Screen name="settings/email" options={{ headerShown: true, title: "Adresse email" }} />
              <Stack.Screen name="settings/notifications" options={{ headerShown: true, title: "Notifications" }} />
              <Stack.Screen name="settings/securite" options={{ headerShown: true, title: "Sécurité du compte" }} />
              <Stack.Screen name="settings/mot-de-passe" options={{ headerShown: true, title: "Mot de passe" }} />
              <Stack.Screen name="settings/telephone" options={{ headerShown: true, title: "Numéro de téléphone" }} />
              <Stack.Screen name="settings/face-id" options={{ headerShown: true, title: "Face ID" }} />
              <Stack.Screen name="settings/appareils" options={{ headerShown: true, title: "Appareils connectés" }} />
              <Stack.Screen name="settings/aide" options={{ headerShown: true, title: "Aide" }} />
            </Stack>
          </UnreadProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import { AuthProvider } from "@/lib/auth";
import { UnreadProvider } from "@/lib/unread";

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
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(auth)" options={{ presentation: "modal" }} />
              <Stack.Screen name="annonce/[id]" options={{ headerShown: true, title: "" }} />
              <Stack.Screen name="messages/[conversationId]" options={{ headerShown: true, title: "Conversation" }} />
            </Stack>
          </UnreadProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

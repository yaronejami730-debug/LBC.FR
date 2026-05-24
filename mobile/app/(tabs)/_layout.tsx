import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUnread } from "@/lib/unread";

type IconName = keyof typeof Ionicons.glyphMap;

function makeIcon(name: IconName) {
  return ({ focused, color }: { focused: boolean; color: string }) => (
    <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={24} color={color} />
  );
}

export default function TabsLayout() {
  const { count } = useUnread();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2f6fb8",
        tabBarInactiveTintColor: "#777683",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#eceef0",
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil", tabBarIcon: makeIcon("home") }} />
      <Tabs.Screen name="alertes" options={{ title: "Alertes", tabBarIcon: makeIcon("notifications") }} />
      <Tabs.Screen name="post" options={{ title: "Publier", tabBarIcon: makeIcon("add-circle") }} />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: makeIcon("chatbubble"),
          tabBarBadge: count > 0 ? (count > 99 ? "99+" : count) : undefined,
          tabBarBadgeStyle: { backgroundColor: "#ef4444", color: "#ffffff", fontSize: 10 },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: makeIcon("person") }} />
    </Tabs>
  );
}

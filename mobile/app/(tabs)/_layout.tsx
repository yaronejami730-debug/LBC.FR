import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return <Text style={{ fontSize: 11, color: focused ? "#2f6fb8" : "#777683", fontWeight: focused ? "700" : "500" }}>{label}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2f6fb8",
        tabBarInactiveTintColor: "#777683",
        tabBarStyle: { backgroundColor: "#ffffff", borderTopColor: "#eceef0", height: 60, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil" }} />
      <Tabs.Screen name="recherche" options={{ title: "Recherche" }} />
      <Tabs.Screen name="post" options={{ title: "Publier" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
    </Tabs>
  );
}

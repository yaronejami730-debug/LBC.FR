import { useEffect, useState } from "react";
import { View, Text, Switch, ActivityIndicator, Alert, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { registerExpoPushToken } from "@/lib/push";

const PUSH_PREF = "dealandco.pref.push";

type Channel = "push" | "email";
type EventKey =
  | "messages"
  | "favorites"
  | "listingPublished"
  | "listingExpiring"
  | "newsletter"
  | "personalized"
  | "partners";

type Preferences = Partial<Record<EventKey, Partial<Record<Channel, boolean>>>>;

type Section = {
  title: string;
  rows: { key: EventKey; label: string; channels: Channel[] }[];
};

const SECTIONS: Section[] = [
  {
    title: "Messagerie",
    rows: [{ key: "messages", label: "Nouveaux messages", channels: ["push", "email"] }],
  },
  {
    title: "Vie de l'annonce",
    rows: [
      { key: "favorites", label: "Mise en favoris de mes annonces", channels: ["push", "email"] },
      { key: "listingPublished", label: "Mise en ligne de mes annonces", channels: ["push"] },
      { key: "listingExpiring", label: "Expiration de mes annonces", channels: ["push"] },
    ],
  },
  {
    title: "Actus, offres et conseils",
    rows: [
      { key: "newsletter", label: "Newsletters : nouvelles fonctionnalités, offres promo, tendances", channels: ["push", "email"] },
      { key: "personalized", label: "Communications personnalisées selon votre utilisation", channels: ["push", "email"] },
      { key: "partners", label: "Communications en collaboration avec nos partenaires", channels: ["email"] },
    ],
  },
];

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [pushDevice, setPushDevice] = useState(true);
  const [prefs, setPrefs] = useState<Preferences>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(PUSH_PREF).then((v) => setPushDevice(v !== "off")).catch(() => {});
    apiFetch<{ preferences: Preferences }>("/api/profile/notifications")
      .then((r) => setPrefs(r.preferences))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  const togglePushDevice = async (value: boolean) => {
    setPushDevice(value);
    await SecureStore.setItemAsync(PUSH_PREF, value ? "on" : "off");
    if (value) registerExpoPushToken().catch(() => {});
  };

  const toggleChannel = async (event: EventKey, channel: Channel, value: boolean) => {
    const prev = prefs;
    const next: Preferences = {
      ...prefs,
      [event]: { ...(prefs[event] || {}), [channel]: value },
    };
    setPrefs(next);
    setBusy(true);
    try {
      const r = await apiFetch<{ preferences: Preferences }>("/api/profile/notifications", {
        method: "PATCH",
        body: JSON.stringify({ preferences: next }),
      });
      setPrefs(r.preferences);
    } catch (e) {
      setPrefs(prev);
      Alert.alert("Erreur", e instanceof Error ? e.message : "Échec de la mise à jour");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#2f6fb8" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      {/* Device-level push toggle */}
      <View className="bg-surface-container-low rounded-2xl px-4 py-3 mb-5 flex-row items-center">
        <View className="flex-1 mr-3">
          <Text className="text-on-surface font-semibold">Notifications push sur cet appareil</Text>
          <Text className="text-on-surface-variant text-xs mt-0.5">
            Désactive toutes les notifications push sur cet iPhone, peu importe les préférences ci-dessous.
          </Text>
        </View>
        <Switch value={pushDevice} onValueChange={togglePushDevice} trackColor={{ true: "#2f6fb8" }} />
      </View>

      {SECTIONS.map((section) => (
        <View key={section.title} className="border border-surface-container rounded-2xl mb-4 overflow-hidden">
          <Text className="text-on-surface font-extrabold px-4 pt-4 pb-2">{section.title}</Text>
          {section.rows.map((row, i) => (
            <View key={row.key} className={`px-4 py-3 ${i === section.rows.length - 1 ? "" : "border-b border-surface-container"}`}>
              <Text className="text-on-surface text-sm font-semibold mb-2">{row.label}</Text>
              {row.channels.map((ch) => (
                <ChannelRow
                  key={ch}
                  channel={ch}
                  value={Boolean(prefs[row.key]?.[ch])}
                  onChange={(v) => toggleChannel(row.key, ch, v)}
                  disabled={busy}
                />
              ))}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function ChannelRow({
  channel, value, onChange, disabled,
}: {
  channel: Channel;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  const isPush = channel === "push";
  return (
    <View className="flex-row items-center py-2">
      <View className={`w-6 h-6 rounded-full items-center justify-center ${isPush ? "bg-blue-50" : "bg-pink-50"}`}>
        <Ionicons name={isPush ? "phone-portrait" : "mail"} size={14} color={isPush ? "#2f6fb8" : "#be185d"} />
      </View>
      <Text className="text-on-surface text-sm font-semibold ml-2 flex-1">
        {isPush ? "Notifications mobile" : "E-mails"}
      </Text>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: "#2f6fb8" }} />
    </View>
  );
}

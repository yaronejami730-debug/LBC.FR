import { useEffect, useState } from "react";
import { View, Text, Switch, ActivityIndicator, Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { registerExpoPushToken } from "@/lib/push";

const PUSH_PREF = "dealandco.pref.push";

export default function NotificationsScreen() {
  const { user, refresh } = useAuth();
  const [push, setPush] = useState(true);
  const [marketing, setMarketing] = useState(Boolean(user?.marketingConsent));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(PUSH_PREF).then((v) => setPush(v !== "off")).catch(() => {});
  }, []);

  const togglePush = async (value: boolean) => {
    setPush(value);
    await SecureStore.setItemAsync(PUSH_PREF, value ? "on" : "off");
    if (value) registerExpoPushToken().catch(() => {});
  };

  const toggleMarketing = async (value: boolean) => {
    setMarketing(value);
    setBusy(true);
    try {
      await apiFetch("/api/profile", { method: "PATCH", body: JSON.stringify({ marketingConsent: value }) });
      await refresh();
    } catch (e) {
      setMarketing(!value);
      Alert.alert("Erreur", e instanceof Error ? e.message : "Échec de la mise à jour");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-surface p-4">
      <Row
        title="Notifications push"
        subtitle="Messages, offres et activité de vos annonces"
        value={push}
        onChange={togglePush}
      />
      <Row
        title="Emails marketing"
        subtitle="Conseils, nouveautés et promotions par email"
        value={marketing}
        onChange={toggleMarketing}
        disabled={busy}
      />
      {busy && <ActivityIndicator color="#2f6fb8" className="mt-3" />}
    </View>
  );
}

function Row({
  title,
  subtitle,
  value,
  onChange,
  disabled,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between bg-surface-container-low rounded-xl px-4 py-3 mb-3">
      <View className="flex-1 mr-3">
        <Text className="text-on-surface font-semibold">{title}</Text>
        <Text className="text-on-surface-variant text-xs mt-0.5">{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: "#2f6fb8" }}
      />
    </View>
  );
}

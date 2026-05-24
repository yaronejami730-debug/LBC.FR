import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Pressable, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { timeAgo } from "@/lib/format";

type Device = {
  id: string;
  kind: "mobile" | "web";
  platform: string | null;
  deviceName: string | null;
  appVersion: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

function iconFor(d: Device): keyof typeof Ionicons.glyphMap {
  if (d.kind === "web") return "desktop-outline";
  if (d.platform === "ios") return "phone-portrait";
  if (d.platform === "android") return "phone-portrait-outline";
  return "phone-portrait-outline";
}

function titleFor(d: Device): string {
  if (d.deviceName) return d.deviceName;
  if (d.kind === "mobile") return d.platform === "ios" ? "iPhone" : d.platform === "android" ? "Android" : "Mobile";
  return "Navigateur web";
}

export default function Appareils() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<Device[]>("/api/account/devices");
      setDevices(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const revoke = (d: Device) => {
    Alert.alert(
      "Révoquer cet appareil ?",
      d.kind === "mobile"
        ? "Les notifications push seront désactivées pour cet appareil."
        : "La session web sera déconnectée.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Révoquer", style: "destructive", onPress: async () => {
            setRevoking(d.id);
            try {
              await apiFetch("/api/account/devices", {
                method: "DELETE",
                body: JSON.stringify({ id: d.id, kind: d.kind }),
              });
              setDevices((prev) => prev.filter((x) => x.id !== d.id));
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Révocation échouée");
            } finally {
              setRevoking(null);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return <View className="flex-1 bg-surface items-center justify-center"><ActivityIndicator color="#2f6fb8" /></View>;
  }

  return (
    <FlatList
      className="flex-1 bg-surface"
      data={devices}
      keyExtractor={(d) => d.id}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <View className="mb-4">
          <Text className="text-on-surface text-xl font-extrabold mb-1">Appareils connectés</Text>
          <Text className="text-on-surface-variant text-sm">
            {devices.length} appareil{devices.length > 1 ? "s" : ""} ayant accédé à votre compte.
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View className="items-center py-12">
          <Ionicons name="phone-portrait-outline" size={48} color="#94a3b8" />
          <Text className="text-on-surface-variant text-center mt-3">
            {error ?? "Aucun appareil enregistré."}
          </Text>
        </View>
      }
      ItemSeparatorComponent={() => <View className="h-2" />}
      renderItem={({ item }) => (
        <View className="bg-surface-container-low rounded-xl px-4 py-3 flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
            <Ionicons name={iconFor(item)} size={20} color="#2f6fb8" />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-on-surface font-bold text-sm" numberOfLines={1}>{titleFor(item)}</Text>
            <Text className="text-on-surface-variant text-xs mt-0.5">
              {item.kind === "mobile" ? "Notifications push actives · " : ""}vu {timeAgo(item.lastSeenAt)}
            </Text>
            {item.appVersion && (
              <Text className="text-on-surface-variant text-[11px]">Version {item.appVersion}</Text>
            )}
          </View>
          <Pressable
            onPress={() => revoke(item)}
            disabled={revoking === item.id}
            hitSlop={10}
            className="px-3 py-2 rounded-full bg-red-50 active:opacity-70"
          >
            {revoking === item.id ? (
              <ActivityIndicator color="#dc2626" size="small" />
            ) : (
              <Text className="text-red-600 text-xs font-bold">Révoquer</Text>
            )}
          </Pressable>
        </View>
      )}
    />
  );
}

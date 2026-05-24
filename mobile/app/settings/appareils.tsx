import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { timeAgo } from "@/lib/format";

type Device = { id: string; firstSeenAt: string; lastSeenAt: string };

export default function Appareils() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
        <Text className="text-on-surface-variant text-sm mb-3">
          Sessions et appareils ayant accédé à votre compte.
        </Text>
      }
      ListEmptyComponent={
        <Text className="text-on-surface-variant text-center py-8">
          {error ?? "Aucun appareil enregistré."}
        </Text>
      }
      ItemSeparatorComponent={() => <View className="h-2" />}
      renderItem={({ item }) => (
        <View className="flex-row items-center bg-surface-container-low rounded-xl px-4 py-3">
          <Ionicons name="phone-portrait-outline" size={22} color="#2f6fb8" />
          <View className="ml-3 flex-1">
            <Text className="text-on-surface font-semibold text-sm">Appareil</Text>
            <Text className="text-on-surface-variant text-xs mt-0.5">
              Dernière activité {timeAgo(item.lastSeenAt)}
            </Text>
            <Text className="text-on-surface-variant text-xs">
              Première connexion {timeAgo(item.firstSeenAt)}
            </Text>
          </View>
        </View>
      )}
    />
  );
}

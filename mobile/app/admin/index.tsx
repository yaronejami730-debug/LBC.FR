import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";
import { useAdminMode } from "@/lib/adminMode";
import { colors } from "@/lib/theme";

type Overview = {
  queues: { pendingListings: number; reviewListings: number; openReports: number; pendingPros: number };
  last24h: { newUsers: number; newListings: number };
};

/**
 * Accueil du mode administrateur : ce qui attend une décision.
 *
 * Pas de graphiques ni d'historique — sur un téléphone, l'administration sert à
 * vider des files entre deux rendez-vous. Les analyses restent sur le site.
 */
export default function AdminHome() {
  const router = useRouter();
  const { setAdminMode } = useAdminMode();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await apiFetch<Overview>("/api/mobile/admin/overview"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-app">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-app"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
    >
      {error && (
        <View className="bg-surface rounded-xl px-4 py-3 mb-3">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      )}

      <View className="flex-row flex-wrap -mx-1 mb-2">
        <Tile
          label="Annonces en attente"
          value={data?.queues.pendingListings ?? 0}
          icon="time-outline"
          onPress={() => router.push("/admin/annonces")}
        />
        <Tile
          label="En revue"
          value={data?.queues.reviewListings ?? 0}
          icon="eye-outline"
          onPress={() => router.push("/admin/annonces?status=UNDER_REVIEW")}
        />
        <Tile
          label="Signalements ouverts"
          value={data?.queues.openReports ?? 0}
          icon="flag-outline"
          onPress={() => router.push("/admin/signalements")}
        />
        <Tile
          label="Pros à vérifier"
          value={data?.queues.pendingPros ?? 0}
          icon="briefcase-outline"
          onPress={() => router.push("/admin/professionnels")}
        />
      </View>

      <View className="bg-surface rounded-xl p-4 mb-3">
        <Text className="text-on-surface font-semibold mb-2">Dernières 24 heures</Text>
        <Text className="text-on-surface-variant text-sm">
          {data?.last24h.newListings ?? 0} annonce{(data?.last24h.newListings ?? 0) > 1 ? "s" : ""} publiée
          {(data?.last24h.newListings ?? 0) > 1 ? "s" : ""} · {data?.last24h.newUsers ?? 0} inscription
          {(data?.last24h.newUsers ?? 0) > 1 ? "s" : ""}
        </Text>
      </View>

      <Pressable
        onPress={async () => {
          await setAdminMode(false);
          router.replace("/(tabs)/profile");
        }}
        className="flex-row items-center justify-center bg-surface rounded-xl px-4 py-3.5 active:opacity-70"
      >
        <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
        <Text className="text-primary font-semibold ml-2">Revenir en mode utilisateur</Text>
      </Pressable>
    </ScrollView>
  );
}

function Tile({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <View className="w-1/2 px-1 mb-2">
      <Pressable onPress={onPress} className="bg-surface rounded-xl p-4 active:opacity-70">
        <Ionicons name={icon} size={20} color={value > 0 ? colors.primary : colors.outline} />
        <Text className="text-on-surface text-2xl font-extrabold mt-2">{value}</Text>
        <Text className="text-on-surface-variant text-xs mt-0.5">{label}</Text>
      </Pressable>
    </View>
  );
}

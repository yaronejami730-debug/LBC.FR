import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, Image, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";
import { colors } from "@/lib/theme";

type AdminReport = {
  id: string;
  category: string;
  message: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; name: string; email: string } | null;
  subject: { id: string; name: string; email: string } | null;
  listing: { id: string; title: string; images: string[]; status: string; price: number } | null;
};

/** Libellés des motifs — les codes bruts ne disent rien à qui arbitre vite. */
const MOTIFS: Record<string, string> = {
  scam: "Arnaque",
  spam: "Spam",
  illegal: "Illégal",
  offensive: "Offensant",
  fake: "Faux produit",
  wrong_category: "Mauvaise catégorie",
  duplicate: "Doublon",
  personal_data: "Données personnelles",
  stolen_photos: "Photos volées",
  other: "Autre",
};

/**
 * Signalements ouverts, du plus ancien au plus récent.
 *
 * Deux issues : « traité » quand le signalement disait vrai et qu'on a agi,
 * « écarté » quand il n'y avait rien. Les distinguer permet plus tard de
 * mesurer la fiabilité de ceux qui signalent, ce qu'un simple « fermé » perd.
 */
export default function AdminSignalements() {
  const router = useRouter();
  const [items, setItems] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const data = await apiFetch<{ reports: AdminReport[] }>("/api/mobile/admin/reports?status=OPEN");
      setItems(data.reports);
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

  async function close(report: AdminReport, decision: "RESOLVED" | "DISMISSED") {
    setBusyId(report.id);
    try {
      await apiFetch("/api/mobile/admin/reports", {
        method: "POST",
        body: JSON.stringify({ id: report.id, decision }),
      });
      setItems((prev) => prev.filter((r) => r.id !== report.id));
    } catch (e) {
      Alert.alert("Action impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading && items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-app">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-app">
      {error && (
        <View className="mx-3 my-2 bg-surface rounded-xl px-4 py-3">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 12 }}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={
          <Text className="text-on-surface-variant text-center mt-10">Aucun signalement ouvert.</Text>
        }
        renderItem={({ item }) => (
          <View className="bg-surface rounded-xl p-3 mb-2">
            <View className="flex-row items-center mb-2">
              <Ionicons name="flag" size={16} color={colors.danger} />
              <Text className="text-on-surface font-bold text-sm ml-1.5">
                {MOTIFS[item.category] ?? item.category}
              </Text>
              <Text className="text-on-surface-variant text-xs ml-auto">
                {new Date(item.createdAt).toLocaleDateString("fr-FR")}
              </Text>
            </View>

            {item.listing && (
              <Pressable
                className="flex-row active:opacity-70"
                onPress={() => router.push(`/annonce/${item.listing!.id}`)}
              >
                {item.listing.images[0] ? (
                  <Image
                    source={{ uri: item.listing.images[0] }}
                    style={{ width: 52, height: 52, borderRadius: 8 }}
                  />
                ) : (
                  <View
                    style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: colors.surfaceContainer }}
                  />
                )}
                <View className="flex-1 ml-3">
                  <Text className="text-on-surface font-semibold text-sm" numberOfLines={2}>
                    {item.listing.title}
                  </Text>
                  <Text className="text-on-surface-variant text-xs mt-0.5">
                    {item.listing.status === "APPROVED" ? "En ligne" : item.listing.status}
                  </Text>
                </View>
              </Pressable>
            )}

            {item.message && (
              <Text className="text-on-surface-variant text-xs mt-2 italic">« {item.message} »</Text>
            )}

            <Text className="text-on-surface-variant text-[11px] mt-2">
              Signalé par {item.reporter?.name ?? "compte supprimé"}
            </Text>

            <View className="flex-row mt-3">
              <Pressable
                onPress={() => close(item, "RESOLVED")}
                disabled={busyId === item.id}
                className="flex-1 items-center py-2.5 rounded-xl mr-2"
                style={{ backgroundColor: colors.primary, opacity: busyId === item.id ? 0.5 : 1 }}
              >
                <Text className="text-white font-bold text-sm">Traité</Text>
              </Pressable>
              <Pressable
                onPress={() => close(item, "DISMISSED")}
                disabled={busyId === item.id}
                className="flex-1 items-center py-2.5 rounded-xl"
                style={{ backgroundColor: colors.surfaceContainer, opacity: busyId === item.id ? 0.5 : 1 }}
              >
                <Text className="font-bold text-sm" style={{ color: colors.onSurfaceVariant }}>
                  Écarter
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

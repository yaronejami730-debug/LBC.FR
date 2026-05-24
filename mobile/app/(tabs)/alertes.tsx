import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { timeAgo } from "@/lib/format";

type SavedSearch = {
  id: string;
  name: string;
  filters: string;
  matchCount?: number;
  createdAt: string;
};

function describeFilters(raw: string): { chips: string[]; q: string; category: string } {
  let f: Record<string, string> = {};
  try { f = JSON.parse(raw); } catch { /* noop */ }
  const chips: string[] = [];
  if (f.category) chips.push(f.category);
  if (f.location) chips.push(f.location);
  if (f.minPrice || f.maxPrice) chips.push(`${f.minPrice ?? "0"}–${f.maxPrice ?? "∞"} €`);
  if (f.condition) chips.push(f.condition);
  return { chips, q: f.q ?? "", category: f.category ?? "" };
}

export default function AlertesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setError(null);
    try {
      const data = await apiFetch<SavedSearch[]>("/api/saved-searches");
      setSearches(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = (s: SavedSearch) => {
    Alert.alert("Supprimer l'alerte", `Supprimer « ${s.name} » ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          setSearches((prev) => prev.filter((x) => x.id !== s.id));
          try { await apiFetch(`/api/saved-searches/${s.id}`, { method: "DELETE" }); } catch { load(); }
        },
      },
    ]);
  };

  const openSearch = (s: SavedSearch) => {
    const { q, category } = describeFilters(s.filters);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    const qs = params.toString();
    router.push(qs ? `/recherche?${qs}` : "/recherche");
  };

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-16 h-16 rounded-full bg-surface-container items-center justify-center mb-4">
            <Ionicons name="notifications-outline" size={32} color="#2f6fb8" />
          </View>
          <Text className="text-on-surface text-xl font-bold mb-2">Alertes</Text>
          <Text className="text-on-surface-variant text-sm mb-6 text-center">
            Connectez-vous pour créer des alertes et recevoir une notif dès qu'une nouvelle annonce correspond.
          </Text>
          <Pressable onPress={() => router.push("/(auth)/login")} className="bg-primary px-6 py-3 rounded-full">
            <Text className="text-white font-bold">Se connecter</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface">
      {/* Header */}
      <View className="px-4 pt-2 pb-3">
        <Text className="text-on-surface text-2xl font-extrabold">Mes alertes</Text>
        <Text className="text-on-surface-variant text-sm mt-0.5">
          Recevez une notification dès qu'une nouvelle annonce correspond à vos critères.
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#2f6fb8" /></View>
      ) : (
        <FlatList
          data={searches}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListEmptyComponent={
            <View className="py-12 items-center px-4">
              <View className="w-20 h-20 rounded-full bg-surface-container items-center justify-center mb-4">
                <Ionicons name="notifications-outline" size={36} color="#2f6fb8" />
              </View>
              <Text className="text-on-surface text-lg font-bold mb-1.5">Aucune alerte pour l'instant</Text>
              <Text className="text-on-surface-variant text-sm text-center mb-6">
                Lancez une recherche, ajustez les filtres puis appuyez sur « Sauvegarder la recherche ».
              </Text>
              <Pressable onPress={() => router.push("/recherche")} className="flex-row items-center bg-primary rounded-full px-5 py-3">
                <Ionicons name="search" size={16} color="#fff" />
                <Text className="text-white font-bold ml-2">Faire une recherche</Text>
              </Pressable>
              {error && <Text className="text-red-600 text-xs mt-4">{error}</Text>}
            </View>
          }
          ListHeaderComponent={
            searches.length > 0 ? (
              <Text className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-2">
                {searches.length} alerte{searches.length > 1 ? "s" : ""}
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const { chips } = describeFilters(item.filters);
            return (
              <View className="bg-surface-container-low rounded-2xl overflow-hidden">
                <Pressable onPress={() => openSearch(item)} className="px-4 pt-3.5 pb-3 active:opacity-80">
                  <View className="flex-row items-center">
                    <View className="w-9 h-9 rounded-full bg-primary/10 items-center justify-center mr-3">
                      <Ionicons name="notifications" size={18} color="#2f6fb8" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-on-surface font-bold text-base" numberOfLines={1}>{item.name}</Text>
                      <Text className="text-on-surface-variant text-xs mt-0.5">Créée {timeAgo(item.createdAt)}</Text>
                    </View>
                    {typeof item.matchCount === "number" && (
                      <View className="bg-primary/10 rounded-full px-2.5 py-1 ml-2">
                        <Text className="text-primary text-xs font-bold">{item.matchCount}</Text>
                      </View>
                    )}
                  </View>

                  {chips.length > 0 && (
                    <View className="flex-row flex-wrap gap-1.5 mt-3">
                      {chips.map((c, i) => (
                        <View key={i} className="bg-surface-container rounded-full px-2.5 py-1">
                          <Text className="text-on-surface-variant text-xs font-semibold">{c}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Pressable>

                {/* Actions */}
                <View className="flex-row border-t border-surface-container">
                  <Pressable onPress={() => openSearch(item)} className="flex-1 flex-row items-center justify-center py-3 active:bg-surface-container">
                    <Ionicons name="eye-outline" size={16} color="#2f6fb8" />
                    <Text className="text-primary font-semibold text-sm ml-1.5">Voir les annonces</Text>
                  </Pressable>
                  <View className="w-px bg-surface-container" />
                  <Pressable onPress={() => remove(item)} className="px-5 flex-row items-center justify-center active:bg-surface-container">
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect, Stack } from "expo-router";
import { apiFetch } from "@/lib/api";
import { formatPrice, firstImage } from "@/lib/format";
import { colors } from "@/lib/theme";
import BackButton from "@/components/ui/BackButton";

type Favorite = {
  id: string;
  listing: {
    id: string;
    title: string;
    price: number;
    location: string;
    images: string | string[] | null;
    createdAt: string;
  };
};

export default function FavorisScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const f = await apiFetch<Favorite[]>("/api/favorites");
      setFavorites(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView className="flex-1 bg-app" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar */}
      <View className="flex-row items-center px-3 py-3">
        <BackButton />
        <Text className="text-on-surface text-lg font-extrabold ml-2 flex-1">Favoris</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(f) => f.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Ionicons name="heart-outline" size={48} color={colors.outline} />
              <Text className="text-on-surface-variant text-center mt-3">
                {error ?? "Aucun favori pour le moment."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/annonce/${item.listing.id}`)}
              className="flex-row border border-line rounded-card bg-surface overflow-hidden active:opacity-80"
            >
              <View className="w-24 h-24 bg-surface-container">
                {firstImage(item.listing.images) && (
                  <Image
                    source={{ uri: firstImage(item.listing.images)! }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                )}
              </View>
              <View className="flex-1 p-3">
                <Text numberOfLines={2} className="text-on-surface text-base font-extrabold">{item.listing.title}</Text>
                <Text className="text-primary text-xl font-extrabold mt-0.5">{formatPrice(item.listing.price)}</Text>
                <Text numberOfLines={1} className="text-on-surface-variant text-xs mt-1">{item.listing.location}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

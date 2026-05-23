import { useEffect, useState, useCallback } from "react";
import { ScrollView, View, Text, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiFetch } from "@/lib/api";
import ListingRow from "@/components/home/ListingRow";
import HeroBanner from "@/components/home/HeroBanner";
import CategoryGrid from "@/components/home/CategoryGrid";
import type { HomeListing } from "@/components/home/ListingCard";

type FeedResponse = {
  featured: HomeListing[];
  bargains: HomeListing[];
  vehicules: HomeListing[];
  immobilier: HomeListing[];
  mode: HomeListing[];
  recents: HomeListing[];
};

export default function HomeScreen() {
  const router = useRouter();
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await apiFetch<FeedResponse>("/api/feed/home", { auth: false });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View className="px-4 pt-2 pb-3 flex-row items-center justify-between">
          <Text className="text-primary text-2xl font-extrabold">Deal&Co</Text>
          <Pressable onPress={() => router.push("/recherche")} className="bg-surface-container rounded-full px-4 py-2">
            <Text className="text-on-surface-variant text-sm">Rechercher…</Text>
          </Pressable>
        </View>

        <View className="px-4">
          <HeroBanner />
        </View>

        <CategoryGrid />

        {loading ? (
          <View className="py-12 items-center"><ActivityIndicator color="#2f6fb8" /></View>
        ) : error ? (
          <View className="px-6 py-8">
            <Text className="text-red-600 text-center">{error}</Text>
            <Pressable onPress={load} className="self-center mt-4 bg-primary px-4 py-2 rounded-full">
              <Text className="text-white font-semibold">Réessayer</Text>
            </Pressable>
          </View>
        ) : data ? (
          <>
            <ListingRow title="Coups de cœur" subtitle="Sélection vérifiée et mise en avant" listings={data.featured} />
            <ListingRow title="Bonnes affaires" subtitle="Sous les 100 €" listings={data.bargains} badge="Bonne affaire" />
            <ListingRow title="Voitures d'occasion" listings={data.vehicules} />
            <ListingRow title="Immobilier" listings={data.immobilier} />
            <ListingRow title="Mode" listings={data.mode} />
            <ListingRow title="Annonces récentes" subtitle="Tout ce qui vient d'être publié" listings={data.recents} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

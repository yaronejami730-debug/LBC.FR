import { useEffect, useState, useCallback } from "react";
import { ScrollView, View, Text, TextInput, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiFetch } from "@/lib/api";
import { track } from "@/lib/track";
import { useAuth } from "@/lib/auth";
import ListingRow from "@/components/home/ListingRow";
import HeroBanner from "@/components/home/HeroBanner";
import AdCarousel from "@/components/home/AdCarousel";
import { type Ad } from "@/components/home/AdCard";
import InterstitialAd from "@/components/InterstitialAd";
import type { HomeListing } from "@/components/home/ListingCard";

type FeedResponse = {
  featured: HomeListing[];
  bargains: HomeListing[];
  vehicules: HomeListing[];
  immobilier: HomeListing[];
  mode: HomeListing[];
  recents: HomeListing[];
};

type PersoResponse = {
  recentSearches: string[];
  recentlyViewed: HomeListing[];
  suggestions: HomeListing[];
  suggestionLabel: string | null;
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<FeedResponse | null>(null);
  const [perso, setPerso] = useState<PersoResponse | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const runSearch = (q: string) => {
    const trimmed = q.trim();
    if (trimmed) track("search", { q: trimmed });
    router.push(trimmed ? `/recherche?q=${encodeURIComponent(trimmed)}` : "/recherche");
  };

  const adAt = (i: number): Ad | null => (ads.length ? ads[i % ads.length] : null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [res, adsRes, persoRes] = await Promise.all([
        apiFetch<FeedResponse>("/api/feed/home", { auth: false }),
        apiFetch<Ad[]>("/api/ads", { auth: false }).catch(() => [] as Ad[]),
        user
          ? apiFetch<PersoResponse>("/api/feed/personalized").catch(() => null)
          : Promise.resolve(null),
      ]);
      setData(res);
      setAds(adsRes);
      setPerso(persoRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const hasRecentSearches = (perso?.recentSearches?.length ?? 0) > 0;
  const hasRecentlyViewed = (perso?.recentlyViewed?.length ?? 0) > 0;
  const hasSuggestions = (perso?.suggestions?.length ?? 0) > 0;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface">
      <InterstitialAd />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View className="px-4 pt-2 pb-3">
          <Text className="text-primary text-2xl font-extrabold mb-2">Deal&Co</Text>
          <View className="flex-row items-center bg-surface-container rounded-full px-4 py-1">
            <Ionicons name="search" size={18} color="#94a3b8" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => runSearch(query)}
              returnKeyType="search"
              placeholder="Rechercher sur Deal&Co"
              placeholderTextColor="#94a3b8"
              className="flex-1 ml-2 py-1.5 text-on-surface"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} className="pl-2">
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </Pressable>
            )}
          </View>
        </View>

        <View className="px-4">
          <HeroBanner />
          <AdCarousel ads={ads} />
        </View>

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
            {/* ── Perso : reprendre vos recherches ────────────────────────── */}
            {hasRecentSearches && (
              <View className="mt-6">
                <Text className="text-on-surface text-lg font-bold px-4 mb-3">Reprendre vos recherches</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                  {perso!.recentSearches.map((q) => (
                    <Pressable
                      key={q}
                      onPress={() => runSearch(q)}
                      className="flex-row items-center bg-surface-container-low border border-surface-container rounded-full px-4 py-2.5 active:opacity-70"
                    >
                      <Ionicons name="time-outline" size={15} color="#2f6fb8" />
                      <Text className="text-on-surface text-sm font-semibold ml-2" numberOfLines={1}>{q}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── Perso : récemment vu ────────────────────────────────────── */}
            {hasRecentlyViewed && (
              <ListingRow title="Vous avez récemment vu" listings={perso!.recentlyViewed} seeAllHref="/recherche" />
            )}

            {/* ── Perso : suggestions par intérêt ─────────────────────────── */}
            {hasSuggestions && (
              <ListingRow
                title="Suggestions pour vous"
                subtitle="Basé sur vos dernières visites"
                listings={perso!.suggestions}
                seeAllHref="/recherche"
                ad={adAt(0)}
              />
            )}

            {/* ── Base / fallback : jamais vide, jamais l'anarchie ────────── */}
            <ListingRow title="Annonces récentes" subtitle="Tout ce qui vient d'être publié" listings={data.recents} seeAllHref="/recherche" ad={adAt(1)} />
            <ListingRow title="Coups de cœur" subtitle="Sélection vérifiée et mise en avant" listings={data.featured} seeAllHref="/recherche" />
            <ListingRow title="Bonnes affaires" subtitle="Sous les 100 €" listings={data.bargains} badge="Bonne affaire" seeAllHref="/recherche" ad={adAt(2)} />
            <ListingRow title="Voitures d'occasion" listings={data.vehicules} seeAllHref="/recherche?category=Véhicules" />
            <ListingRow title="Immobilier" listings={data.immobilier} seeAllHref="/recherche?category=Immobilier" ad={adAt(3)} />
            <ListingRow title="Mode" listings={data.mode} seeAllHref="/recherche?category=Mode" />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { apiFetch } from "@/lib/api";
import { formatPrice, firstImage, timeAgo } from "@/lib/format";

type Listing = {
  id: string;
  title: string;
  price: number | string;
  location: string;
  images: string | string[] | null;
  createdAt: string;
  category?: string;
};

type ListingsResponse = {
  listings: Listing[];
  total: number;
  page: number;
  perPage: number;
};

const CATEGORIES = [
  { id: "", label: "Tout" },
  { id: "Immobilier", label: "Immobilier" },
  { id: "Véhicules", label: "Véhicules" },
  { id: "Mode", label: "Mode" },
  { id: "Maison", label: "Maison" },
  { id: "Multimédia", label: "Multimédia" },
  { id: "Loisirs", label: "Loisirs" },
];

export default function RechercheScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  const [query, setQuery] = useState(params.q ?? "");
  const [submittedQuery, setSubmittedQuery] = useState(params.q ?? "");
  const [category, setCategory] = useState(params.category ?? "");
  const [listings, setListings] = useState<Listing[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextPage = 1) => {
      const isFirst = nextPage === 1;
      if (isFirst) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (submittedQuery.trim()) qs.set("q", submittedQuery.trim());
        if (category) qs.set("category", category);
        qs.set("page", String(nextPage));
        const res = await apiFetch<ListingsResponse>(
          `/api/listings?${qs.toString()}`,
          { auth: false },
        );
        setTotal(res.total);
        setPage(res.page);
        setListings((prev) => (isFirst ? res.listings : [...prev, ...res.listings]));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [submittedQuery, category],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const onSubmit = () => setSubmittedQuery(query);

  const onLoadMore = () => {
    if (loadingMore || loading) return;
    if (listings.length >= total) return;
    load(page + 1);
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface">
      <View className="px-4 pt-2 pb-2">
        <View className="flex-row gap-2 items-center">
          <Pressable onPress={() => router.back()} className="p-1 active:opacity-60">
            <Ionicons name="chevron-back" size={26} color="#2f6fb8" />
          </Pressable>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={onSubmit}
            returnKeyType="search"
            autoFocus={!params.q}
            placeholder="Que cherchez-vous ?"
            placeholderTextColor="#94a3b8"
            className="flex-1 bg-surface-container rounded-full px-4 py-2.5 text-on-surface"
          />
          <Pressable
            onPress={onSubmit}
            className="bg-primary rounded-full px-4 py-2.5 active:opacity-80"
          >
            <Text className="text-white font-bold">OK</Text>
          </Pressable>
        </View>

        <View className="mt-3">
          <FlatList
            data={CATEGORIES}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id || "all"}
            renderItem={({ item }) => {
              const active = category === item.id;
              return (
                <Pressable
                  onPress={() => setCategory(item.id)}
                  className={`px-3 py-1.5 rounded-full mr-2 ${active ? "bg-primary" : "bg-surface-container"}`}
                >
                  <Text className={`text-sm font-semibold ${active ? "text-white" : "text-on-surface-variant"}`}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </View>

      {loading && page === 1 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#2f6fb8" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-red-600 text-center mb-4">{error}</Text>
          <Pressable onPress={() => load(1)} className="bg-primary px-4 py-2 rounded-full">
            <Text className="text-white font-semibold">Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32 }}
          columnWrapperStyle={{ gap: 8 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListHeaderComponent={
            <Text className="text-on-surface-variant text-sm mb-2 mt-1">
              {total.toLocaleString("fr-FR")} annonces
            </Text>
          }
          ListEmptyComponent={
            <View className="py-12 items-center">
              <Text className="text-on-surface-variant">Aucun résultat</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color="#2f6fb8" style={{ marginTop: 16 }} /> : null
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(1);
              }}
            />
          }
          renderItem={({ item }) => {
            const img = firstImage(item.images);
            return (
              <Pressable
                onPress={() => router.push(`/annonce/${item.id}`)}
                className="flex-1 bg-surface-container-low rounded-xl overflow-hidden active:opacity-80"
              >
                <View style={{ width: "100%", aspectRatio: 1 }} className="bg-surface-container">
                  {img ? (
                    <Image
                      source={{ uri: img }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <Text className="text-outline text-xs">Aucune photo</Text>
                    </View>
                  )}
                </View>
                <View className="p-2">
                  <Text numberOfLines={2} className="text-on-surface text-sm font-semibold leading-snug">
                    {item.title}
                  </Text>
                  <Text className="text-primary text-base font-extrabold mt-1">{formatPrice(item.price)}</Text>
                  <Text numberOfLines={1} className="text-on-surface-variant text-xs mt-0.5">
                    {item.location} · {timeAgo(item.createdAt)}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

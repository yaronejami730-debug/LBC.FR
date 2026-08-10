import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  ActionSheetIOS,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { apiFetch } from "@/lib/api";
import { track } from "@/lib/track";
import { useAuth } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import FilterSheet, {
  type Filters,
  type SortKey,
  EMPTY_FILTERS,
  filtersToQuery,
  countActiveFilters,
} from "@/components/search/FilterSheet";
import { colors } from "@/lib/theme";
import BackButton from "@/components/ui/BackButton";
import SearchListingCard from "@/components/search/SearchListingCard";

type Listing = {
  id: string;
  title: string;
  price: number | string;
  location: string;
  images: string | string[] | null;
  createdAt: string;
  condition?: string | null;
  vehicleKm?: number | null;
  vehicleYear?: number | null;
  isPremium?: boolean;
  user?: { name: string; verified?: boolean; isPro?: boolean; companyName?: string | null; avatar?: string | null };
};

type ListingsResponse = { listings: Listing[]; total: number; page: number; perPage: number };

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Plus récentes",
  price_asc: "Prix croissant",
  price_desc: "Prix décroissant",
};

export default function RechercheScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ q?: string; category?: string; focus?: string }>();

  const initialCategory = params.category
    ? CATEGORIES.find((c) => c.id === params.category || c.label === params.category)?.label ?? ""
    : "";

  const [query, setQuery] = useState(params.q ?? "");
  const [appliedQuery, setAppliedQuery] = useState(params.q ?? "");
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS, category: initialCategory });
  const [sheetOpen, setSheetOpen] = useState(false);

  const [listings, setListings] = useState<Listing[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingAlert, setSavingAlert] = useState(false);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<{ type: "query" | "listing"; value: string; sub?: string; id?: string }[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const suggTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (nextPage = 1) => {
      const isFirst = nextPage === 1;
      if (isFirst) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const qs = filtersToQuery(filters, appliedQuery);
        const res = await apiFetch<ListingsResponse>(`/api/listings?${qs}&page=${nextPage}`, { auth: false });
        setTotal(res.total);
        setPage(res.page);
        setListings((prev) => (isFirst ? res.listings : [...prev, ...res.listings]));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filters, appliedQuery],
  );

  useEffect(() => { load(1); }, [load]);

  // Autocomplétion : debounce + fetch /api/listings/suggest.
  useEffect(() => {
    if (suggTimer.current) clearTimeout(suggTimer.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    suggTimer.current = setTimeout(() => {
      apiFetch<typeof suggestions>(`/api/listings/suggest?q=${encodeURIComponent(query.trim())}`, { auth: false })
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 200);
    return () => { if (suggTimer.current) clearTimeout(suggTimer.current); };
  }, [query]);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ listing: { id: string } }[]>("/api/favorites")
      .then((favs) => setFavIds(new Set(favs.map((f) => f.listing.id))))
      .catch(() => {});
  }, [user]);

  const toggleFav = async (id: string) => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    const next = !favIds.has(id);
    setFavIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(id); else s.delete(id);
      return s;
    });
    try {
      await apiFetch("/api/favorites", {
        method: next ? "POST" : "DELETE",
        body: JSON.stringify({ listingId: id }),
      });
    } catch {
      setFavIds((prev) => {
        const s = new Set(prev);
        if (next) s.delete(id); else s.add(id);
        return s;
      });
    }
  };

  const onLoadMore = () => {
    if (loadingMore || loading || listings.length >= total) return;
    load(page + 1);
  };

  const openSort = () => {
    const order: SortKey[] = ["recent", "price_asc", "price_desc"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Annuler", ...order.map((s) => SORT_LABELS[s])], cancelButtonIndex: 0 },
        (i) => { if (i >= 1) setFilters((f) => ({ ...f, sort: order[i - 1] })); },
      );
    } else {
      Alert.alert("Trier par", undefined, [
        ...order.map((s) => ({ text: SORT_LABELS[s], onPress: () => setFilters((f) => ({ ...f, sort: s })) })),
        { text: "Annuler", style: "cancel" as const },
      ]);
    }
  };

  const saveAlert = async () => {
    if (!user) { router.push("/(auth)/login"); return; }
    const f: Record<string, string> = {};
    if (appliedQuery.trim()) f.q = appliedQuery.trim();
    if (filters.category) f.category = filters.category;
    if (filters.minPrice) f.minPrice = filters.minPrice;
    if (filters.maxPrice) f.maxPrice = filters.maxPrice;
    if (filters.location.trim()) f.location = filters.location.trim();
    const name = f.q || filters.category || "Toutes les annonces";
    setSavingAlert(true);
    try {
      await apiFetch("/api/saved-searches", { method: "POST", body: JSON.stringify({ name, filters: f }) });
      Alert.alert("Recherche sauvegardée", "Vous serez notifié des nouvelles annonces correspondantes.");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Échec");
    } finally {
      setSavingAlert(false);
    }
  };

  const activeCount = countActiveFilters(filters);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-app">
      {/* Barre recherche + retour */}
      <View className="flex-row items-center gap-2 px-3 pt-1 pb-2">
        <BackButton />
        <View className="flex-1 flex-row items-center bg-surface border border-line rounded-full px-3 py-2">
          <Ionicons name="search" size={18} color={colors.outline} />
          <TextInput
            value={query}
            onChangeText={(v) => { setQuery(v); setShowSugg(true); }}
            onFocus={() => setShowSugg(true)}
            onSubmitEditing={() => {
              const q = query.trim();
              setAppliedQuery(query);
              setShowSugg(false);
              if (q) track("search", { q });
            }}
            returnKeyType="search"
            autoFocus={params.focus === "1"}
            placeholder="Que cherchez-vous ?"
            placeholderTextColor={colors.outline}
            className="flex-1 ml-2 text-on-surface"
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(""); setShowSugg(false); }} className="pl-2">
              <Ionicons name="close-circle" size={18} color={colors.outline} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Pills : Filtres / Catégorie / Tri */}
      <View className="flex-row gap-2 px-3 pb-2">
        <Pressable onPress={() => setSheetOpen(true)} className="flex-row items-center border border-primary rounded-full px-3 py-2">
          <Ionicons name="options-outline" size={16} color={colors.primary} />
          <Text className="text-primary font-bold text-sm ml-1">Filtres</Text>
          {activeCount > 0 && (
            <View className="bg-primary rounded-full w-5 h-5 items-center justify-center ml-1.5">
              <Text className="text-white text-[10px] font-bold">{activeCount}</Text>
            </View>
          )}
        </Pressable>

        {filters.category ? (
          <Pressable onPress={() => setFilters((f) => ({ ...f, category: "" }))} className="flex-row items-center border border-primary rounded-full px-3 py-2">
            <Text className="text-primary font-bold text-sm">{filters.category}</Text>
            <Ionicons name="close-circle" size={16} color={colors.primary} style={{ marginLeft: 4 }} />
          </Pressable>
        ) : null}

        <Pressable onPress={openSort} className="flex-row items-center border border-primary rounded-full px-3 py-2">
          <Text className="text-primary font-bold text-sm">Tri : {SORT_LABELS[filters.sort]}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.primary} style={{ marginLeft: 2 }} />
        </Pressable>
      </View>

      {showSugg && suggestions.length > 0 && (
        <View className="bg-surface border-t border-b border-line">
          {suggestions.map((s, i) => (
            <Pressable
              key={`${s.type}-${i}-${s.value}`}
              onPress={() => {
                if (s.type === "listing" && s.id) {
                  setShowSugg(false);
                  router.push(`/annonce/${s.id}`);
                } else {
                  setQuery(s.value);
                  setAppliedQuery(s.value);
                  setShowSugg(false);
                  if (s.value.trim()) track("search", { q: s.value.trim() });
                }
              }}
              className="flex-row items-center px-4 py-3 active:bg-surface-container"
            >
              <Ionicons name={s.type === "query" ? "search" : "pricetag-outline"} size={18} color={colors.outline} />
              <View className="flex-1 ml-3">
                <Text className="text-on-surface text-sm" numberOfLines={1}>
                  {s.type === "query" ? `Rechercher "${s.value}"` : s.value}
                </Text>
                {s.sub && <Text className="text-on-surface-variant text-xs mt-0.5">{s.sub}</Text>}
              </View>
              <Ionicons name="arrow-up" size={14} color={colors.outline} style={{ transform: [{ rotate: "-45deg" }] }} />
            </Pressable>
          ))}
        </View>
      )}

      {loading && page === 1 ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-danger text-center mb-4">{error}</Text>
          <Pressable onPress={() => load(1)} className="bg-primary px-4 py-2 rounded-full">
            <Text className="text-white font-semibold">Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 90 }}
          ListHeaderComponent={
            <Text className="text-on-surface font-bold text-base mb-2 mt-1">
              {total.toLocaleString("fr-FR")} annonce{total > 1 ? "s" : ""}
            </Text>
          }
          ListEmptyComponent={<View className="py-16 items-center"><Text className="text-on-surface-variant">Aucun résultat</Text></View>}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} /> : null}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.5}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <SearchListingCard
              listing={item}
              favorite={favIds.has(item.id)}
              onPress={() => router.push(`/annonce/${item.id}`)}
              onToggleFavorite={() => toggleFav(item.id)}
            />
          )}
        />
      )}

      {/* Bouton flottant sauvegarder */}
      <View className="absolute left-0 right-0 bottom-5 items-center">
        <Pressable
          onPress={saveAlert}
          disabled={savingAlert}
          className="flex-row items-center bg-primary px-6 py-3.5 rounded-full shadow-lg active:opacity-90"
          style={{ shadowColor: colors.navy, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 }}
        >
          <Ionicons name="notifications-outline" size={18} color={colors.white} />
          <Text className="text-white font-bold ml-2">{savingAlert ? "Sauvegarde…" : "Sauvegarder la recherche"}</Text>
        </Pressable>
      </View>

      <FilterSheet
        visible={sheetOpen}
        initial={filters}
        query={appliedQuery}
        onClose={() => setSheetOpen(false)}
        onApply={(f) => { setFilters(f); setSheetOpen(false); }}
      />
    </SafeAreaView>
  );
}

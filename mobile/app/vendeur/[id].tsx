import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  useWindowDimensions,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";
import ListingCard, { type HomeListing } from "@/components/home/ListingCard";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import BackButton from "@/components/ui/BackButton";

type Seller = {
  id: string;
  name: string;
  companyName: string | null;
  isPro: boolean;
  avatar: string | null;
  verified: boolean;
  memberSince: string;
  listingsCount: number;
  responseTime: string | null;
  subscriberCount: number;
  subscribed: boolean;
  isMe: boolean;
};

type ProfileResponse = {
  user: Seller;
  listings: HomeListing[];
  page: number;
  hasMore: boolean;
};

const GRID_GAP = 12;
const SCREEN_PADDING = 16;

export default function SellerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [listings, setListings] = useState<HomeListing[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subBusy, setSubBusy] = useState(false);

  // Deux colonnes : la carte occupe la moitié de la largeur utile.
  const cardWidth = Math.floor((screenWidth - SCREEN_PADDING * 2 - GRID_GAP) / 2);

  const load = useCallback(
    async (targetPage: number) => {
      try {
        setError(null);
        const res = await apiFetch<ProfileResponse>(`/api/users/${id}?page=${targetPage}`, {
          auth: true,
        });
        setSeller(res.user);
        setListings((prev) => (targetPage === 1 ? res.listings : [...prev, ...res.listings]));
        setPage(res.page);
        setHasMore(res.hasMore);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => {
    if (id) load(1);
  }, [id, load]);

  const onLoadMore = () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    load(page + 1);
  };

  const toggleSubscription = async () => {
    if (!seller) return;
    if (!me) {
      router.push("/(auth)/login");
      return;
    }
    // Bascule optimiste : l'aller-retour réseau ne doit pas figer le bouton.
    const previous = { subscribed: seller.subscribed, count: seller.subscriberCount };
    setSubBusy(true);
    setSeller({
      ...seller,
      subscribed: !previous.subscribed,
      subscriberCount: previous.count + (previous.subscribed ? -1 : 1),
    });
    try {
      const res = await apiFetch<{ subscribed: boolean }>("/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({ sellerId: seller.id }),
      });
      setSeller((s) =>
        s
          ? {
              ...s,
              subscribed: res.subscribed,
              subscriberCount: previous.count + (res.subscribed ? 1 : 0) - (previous.subscribed ? 1 : 0),
            }
          : s,
      );
    } catch (e) {
      setSeller((s) => (s ? { ...s, ...previous, subscriberCount: previous.count } : s));
      if (e instanceof ApiError && e.status === 401) router.push("/(auth)/login");
      else Alert.alert("Abonnement", e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setSubBusy(false);
    }
  };

  const displayName = seller
    ? seller.isPro && seller.companyName
      ? seller.companyName
      : seller.name
    : "";

  const screenOptions = {
    headerShown: true,
    title: displayName,
    headerBackTitle: "Retour",
    headerLeft: () => <BackButton />,
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View className="flex-1 bg-app items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  if (!seller) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View className="flex-1 bg-app items-center justify-center px-8">
          <Ionicons name="person-circle-outline" size={48} color={colors.outline} />
          <Text className="text-on-surface-variant text-center mt-3 mb-5">
            {error ?? "Ce vendeur n'existe plus."}
          </Text>
          <Button label="Réessayer" icon="refresh" onPress={() => { setLoading(true); load(1); }} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <FlatList
        className="flex-1 bg-app"
        data={listings}
        keyExtractor={(l) => l.id}
        numColumns={2}
        columnWrapperStyle={{ gap: GRID_GAP }}
        contentContainerStyle={{ padding: SCREEN_PADDING, paddingBottom: 32, gap: GRID_GAP }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(1); }}
          />
        }
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={{ marginBottom: 4 }}>
            <Card className="p-5 items-center">
              <Avatar name={displayName} uri={seller.avatar} size={88} />

              <Text className="text-on-surface text-xl font-extrabold mt-3 text-center">
                {displayName}
              </Text>

              <View className="flex-row flex-wrap justify-center gap-2 mt-2">
                {seller.isPro && (
                  <View className="bg-navy rounded-full px-3 py-1">
                    <Text className="text-white text-[11px] font-bold uppercase">Professionnel</Text>
                  </View>
                )}
                {seller.verified && (
                  <View className="flex-row items-center bg-primary-light rounded-full px-3 py-1">
                    <Ionicons name="shield-checkmark" size={12} color={colors.primary} />
                    <Text className="text-primary text-[11px] font-bold ml-1">Vendeur vérifié</Text>
                  </View>
                )}
              </View>

              {!seller.isMe && (
                <View className="mt-4">
                  <Button
                    label={seller.subscribed ? "Abonné" : "S'abonner"}
                    icon={seller.subscribed ? "checkmark" : "notifications-outline"}
                    variant={seller.subscribed ? "secondary" : "primary"}
                    loading={subBusy}
                    onPress={toggleSubscription}
                  />
                  <Text className="text-on-surface-variant text-xs text-center mt-2">
                    Prévenu de ses nouvelles annonces
                  </Text>
                </View>
              )}

              <View className="flex-row flex-wrap justify-center mt-5" style={{ gap: GRID_GAP }}>
                <Stat label="Annonces" value={String(seller.listingsCount)} />
                <Stat label="Abonnés" value={String(seller.subscriberCount)} />
                {seller.responseTime && <Stat label="Répond en" value={seller.responseTime} />}
                <Stat label="Membre depuis" value={new Date(seller.memberSince).getFullYear().toString()} />
              </View>
            </Card>

            <Text className="text-on-surface text-lg font-bold mt-6 mb-1">
              Annonces en ligne{" "}
              <Text className="text-on-surface-variant text-sm font-medium">
                ({seller.listingsCount})
              </Text>
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center py-14">
            <Ionicons name="file-tray-outline" size={44} color={colors.outline} />
            <Text className="text-on-surface-variant text-center mt-3">
              {error ?? "Aucune annonce en ligne pour le moment."}
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} /> : null
        }
        renderItem={({ item }) => <ListingCard listing={item} width={cardWidth} />}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="bg-app rounded-xl px-4 py-3 items-center" style={{ minWidth: 96 }}>
      <Text className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">
        {label}
      </Text>
      <Text className="text-primary text-lg font-extrabold mt-0.5">{value}</Text>
    </View>
  );
}

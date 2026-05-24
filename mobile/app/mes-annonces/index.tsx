import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect, Stack } from "expo-router";
import { apiFetch } from "@/lib/api";
import { formatPrice, firstImage } from "@/lib/format";

type Listing = {
  id: string;
  title: string;
  price: number;
  location: string;
  images: string | string[] | null;
  status: string;
  views: number;
  phoneClicks: number;
  messageClicks: number;
  favoritesCount: number;
  expiresAt: string | null;
  isExpired: boolean;
  createdAt: string;
};

type Tab = "online" | "expired" | "rejected";

const TABS: { key: Tab; label: string }[] = [
  { key: "online", label: "En ligne" },
  { key: "expired", label: "Expirées" },
  { key: "rejected", label: "Refusées" },
];

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  return `Créée le ${d.getDate()} ${["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"][d.getMonth()]} ${d.getFullYear()}`;
}

export default function MesAnnoncesScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("online");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (currentTab: Tab) => {
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (currentTab === "rejected") qs.set("status", "REJECTED");
      else if (currentTab === "online") qs.set("status", "APPROVED");
      else if (currentTab === "expired") qs.set("expired", "1");
      const r = await apiFetch<{ listings: Listing[] }>(`/api/listings/mine?${qs.toString()}`);
      let filtered = r.listings;
      // Côté client : pour "En ligne" on exclut explicitement les expirées
      if (currentTab === "online") filtered = filtered.filter((l) => !l.isExpired);
      setListings(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(tab); }, [load, tab]));

  const counts = useMemo(() => {
    // Compteurs simples affichés inline ; pour un compte global, fetch dédié
    return { online: tab === "online" ? listings.length : null, expired: tab === "expired" ? listings.length : null, rejected: tab === "rejected" ? listings.length : null };
  }, [tab, listings.length]);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar */}
      <View className="flex-row items-center px-3 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-1 active:opacity-60">
          <Ionicons name="chevron-back" size={26} color="#1a1a1a" />
        </Pressable>
        <Text className="text-on-surface text-lg font-extrabold ml-2 flex-1">Mes annonces</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-surface-container">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => { setTab(t.key); setLoading(true); }}
              className="flex-1 items-center py-3"
            >
              <Text className={`text-sm font-bold ${active ? "text-primary" : "text-on-surface-variant"}`}>
                {t.label}{counts[t.key] !== null ? ` (${counts[t.key]})` : ""}
              </Text>
              {active && <View className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary" />}
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#2f6fb8" /></View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(tab); }} />}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Ionicons name="document-outline" size={48} color="#94a3b8" />
              <Text className="text-on-surface-variant text-center mt-3">
                {error ?? (tab === "online" ? "Aucune annonce en ligne." : tab === "expired" ? "Aucune annonce expirée." : "Aucune annonce refusée.")}
              </Text>
            </View>
          }
          renderItem={({ item }) => <Card item={item} onPress={() => router.push(`/annonce/${item.id}`)} />}
        />
      )}
    </SafeAreaView>
  );
}

function Card({ item, onPress }: { item: Listing; onPress: () => void }) {
  const img = firstImage(item.images);
  return (
    <View className="border border-surface-container rounded-2xl bg-white overflow-hidden">
      <Pressable onPress={onPress} className="flex-row p-3 active:opacity-80">
        <View className="w-24 h-24 bg-surface-container rounded-xl overflow-hidden">
          {img && <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
        </View>
        <View className="flex-1 ml-3">
          <Text numberOfLines={2} className="text-on-surface text-base font-extrabold">{item.title}</Text>
          <View className="flex-row items-center mt-1">
            <Text className="text-on-surface text-xl font-extrabold mr-2">{formatPrice(item.price)}</Text>
            {item.status === "PENDING" && <Badge color="amber" label="En attente" />}
            {item.status === "REJECTED" && <Badge color="red" label="Refusée" />}
            {item.isExpired && <Badge color="gray" label="Expirée" />}
          </View>
          <Text className="text-on-surface-variant text-xs mt-1">{formatCreatedAt(item.createdAt)}</Text>
        </View>
        <Pressable hitSlop={10} className="p-1 self-start active:opacity-60">
          <Ionicons name="ellipsis-vertical" size={18} color="#64748b" />
        </Pressable>
      </Pressable>

      {/* CTA Booster — visible si en ligne */}
      {item.status === "APPROVED" && !item.isExpired && (
        <Pressable
          onPress={() => { /* TODO: route booster */ }}
          className="mx-3 mb-3 bg-primary py-3 rounded-xl items-center active:opacity-80"
        >
          <Text className="text-white font-bold text-base">Booster</Text>
        </Pressable>
      )}

      {/* Stats footer */}
      <View className="flex-row border-t border-surface-container px-3 py-2.5">
        <Stat icon="eye" value={item.views} />
        <Stat icon="heart" value={item.favoritesCount} />
        <Stat icon="chatbubble" value={item.messageClicks} />
        <Stat icon="call" value={item.phoneClicks} />
      </View>
    </View>
  );
}

function Stat({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: number }) {
  return (
    <View className="flex-1 flex-row items-center justify-center">
      <Ionicons name={icon} size={14} color="#64748b" />
      <Text className="text-on-surface text-sm font-semibold ml-1.5">{value}</Text>
    </View>
  );
}

function Badge({ color, label }: { color: "amber" | "red" | "gray"; label: string }) {
  const bg = color === "amber" ? "bg-amber-100" : color === "red" ? "bg-red-100" : "bg-surface-container";
  const fg = color === "amber" ? "text-amber-900" : color === "red" ? "text-red-800" : "text-on-surface-variant";
  return (
    <View className={`px-2 py-0.5 rounded-full ${bg}`}>
      <Text className={`text-[10px] font-bold ${fg}`}>{label}</Text>
    </View>
  );
}

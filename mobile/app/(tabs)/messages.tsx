import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { firstImage, formatPrice, timeAgo } from "@/lib/format";

type Conversation = {
  id: string;
  updatedAt: string;
  listing: { id: string; title: string; price: number; images: string | string[] | null };
  participants: { userId: string; user: { id: string; name: string; avatar?: string | null; verified?: boolean } }[];
  lastMessage: { content: string; createdAt: string; senderId: string; read: boolean } | null;
  unread: boolean;
};

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = conversations.filter((c) => c.unread).length;
  const visibleConversations = filter === "unread" ? conversations.filter((c) => c.unread) : conversations;

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await apiFetch<Conversation[]>("/api/conversations");
      setConversations(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-on-surface text-xl font-bold mb-2">Messages</Text>
          <Text className="text-on-surface-variant text-sm mb-6 text-center">Connectez-vous pour voir vos conversations.</Text>
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
      <View className="px-4 pt-2 pb-3 border-b border-surface-container">
        <Text className="text-on-surface text-2xl font-extrabold">Mes messages</Text>
        {/* Filtres carrés : Tout / Non lu */}
        <View className="flex-row gap-2 mt-3">
          <FilterBtn label="Tout" active={filter === "all"} onPress={() => setFilter("all")} />
          <FilterBtn
            label={`Non lu${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
            active={filter === "unread"}
            onPress={() => setFilter("unread")}
          />
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#2f6fb8" /></View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-red-600 text-center mb-4">{error}</Text>
          <Pressable onPress={load} className="bg-primary px-4 py-2 rounded-full">
            <Text className="text-white font-semibold">Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={visibleConversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View className="py-16 items-center px-6">
              <Text className="text-on-surface-variant text-center">
                {filter === "unread" ? "Aucun message non lu." : "Aucune conversation pour le moment."}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View className="h-px bg-surface-container mx-4" />}
          renderItem={({ item }) => {
            const other = item.participants.find((p) => p.userId !== user.id)?.user;
            const img = firstImage(item.listing.images);
            return (
              <Pressable
                onPress={() => router.push(`/messages/${item.id}`)}
                className="flex-row px-4 py-3 active:bg-surface-container-low"
              >
                <View className="w-14 h-14 rounded-md bg-surface-container overflow-hidden mr-3">
                  {img && <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
                </View>
                <View className="flex-1">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-on-surface font-bold flex-1" numberOfLines={1}>{other?.name ?? "Utilisateur"}</Text>
                    {item.lastMessage && (
                      <Text className="text-on-surface-variant text-xs ml-2">{timeAgo(item.lastMessage.createdAt)}</Text>
                    )}
                  </View>
                  <Text className="text-on-surface-variant text-xs" numberOfLines={1}>
                    {item.listing.title} · {formatPrice(item.listing.price)}
                  </Text>
                  {item.lastMessage && (
                    <Text
                      numberOfLines={1}
                      className={`text-sm mt-0.5 ${item.unread ? "text-on-surface font-semibold" : "text-on-surface-variant"}`}
                    >
                      {item.lastMessage.content}
                    </Text>
                  )}
                </View>
                {item.unread && <View className="w-2.5 h-2.5 rounded-full bg-primary self-center ml-2" />}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function FilterBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-4 py-2 rounded-lg border ${active ? "bg-primary border-primary" : "bg-surface border-surface-container"}`}
    >
      <Text className={`text-sm font-bold ${active ? "text-white" : "text-on-surface-variant"}`}>{label}</Text>
    </Pressable>
  );
}

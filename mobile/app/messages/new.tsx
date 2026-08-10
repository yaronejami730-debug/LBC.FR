import { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";
import { colors } from "@/lib/theme";
import { useGoBack } from "@/lib/navigation";

/**
 * Écran transitoire ouvert depuis le bouton "Message" d'une annonce.
 * Crée/récupère la conversation côté serveur puis remplace par /messages/[id].
 * Affiche un skeleton pour donner la sensation que l'écran est déjà ouvert.
 */
export default function NewMessageScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const { listingId, sellerId } = useLocalSearchParams<{ listingId?: string; sellerId?: string }>();

  useEffect(() => {
    if (!listingId || !sellerId) {
      goBack();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const conv = await apiFetch<{ id: string }>("/api/conversations", {
          method: "POST",
          body: JSON.stringify({ listingId, sellerId }),
        });
        if (cancelled) return;
        router.replace(`/messages/${conv.id}`);
      } catch (e) {
        if (cancelled) return;
        goBack();
        console.error("[messages/new]", e);
      }
    })();
    return () => { cancelled = true; };
  }, [listingId, sellerId, router]);

  return (
    <SafeAreaView className="flex-1 bg-app" edges={["top"]}>
      <View className="flex-row items-center px-3 py-3 border-b border-line">
        <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        <Text className="text-on-surface text-base font-extrabold ml-2 flex-1">Nouvelle conversation</Text>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
      <View className="p-4">
        <Skeleton width="60%" height={18} />
        <View style={{ height: 24 }} />
        <Skeleton width="90%" height={48} borderRadius={16} />
        <View style={{ height: 12 }} />
        <Skeleton width="70%" height={48} borderRadius={16} />
      </View>
    </SafeAreaView>
  );
}

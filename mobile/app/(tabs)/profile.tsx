import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { getToken } from "@/lib/tokenStore";
import { formatPrice, firstImage } from "@/lib/format";

type MineListing = {
  id: string;
  title: string;
  price: number;
  location: string;
  images: string | string[] | null;
  status: string;
  views: number;
  createdAt: string;
};

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

type Tab = "annonces" | "favoris";

async function uploadAvatarAsync(uri: string): Promise<string> {
  const token = await getToken();
  const form = new FormData();
  const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime = ext === "png" ? "image/png" : "image/jpeg";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form.append("file", { uri, name: `avatar.${ext}`, type: mime } as any);
  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data.url as string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, loading, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>("annonces");
  const [mine, setMine] = useState<MineListing[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [busy, setBusy] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const [m, f] = await Promise.all([
        apiFetch<{ listings: MineListing[] }>("/api/listings/mine"),
        apiFetch<Favorite[]>("/api/favorites"),
      ]);
      setMine(m.listings);
      setFavorites(f);
    } catch {
      // silencieux : l'utilisateur peut voir une liste vide et réessayer en pull-to-refresh
    } finally {
      setBusy(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled || res.assets.length === 0) return;
    setSavingAvatar(true);
    try {
      const url = await uploadAvatarAsync(res.assets[0].uri);
      await apiFetch("/api/profile", { method: "PATCH", body: JSON.stringify({ avatar: url }) });
      await refresh();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Mise à jour échouée");
    } finally {
      setSavingAvatar(false);
    }
  };

  if (loading) {
    return <SafeAreaView className="flex-1 bg-surface"><View className="flex-1" /></SafeAreaView>;
  }

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-on-surface text-2xl font-extrabold mb-2">Bienvenue sur Deal&Co</Text>
          <Text className="text-on-surface-variant text-sm mb-8 text-center">
            Connectez-vous pour gérer vos annonces, favoris et messages.
          </Text>
          <Pressable
            onPress={() => router.push("/(auth)/login")}
            className="bg-primary px-8 py-3 rounded-full mb-3 w-full max-w-xs items-center"
          >
            <Text className="text-white font-bold">Se connecter</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(auth)/register")}
            className="border border-primary px-8 py-3 rounded-full w-full max-w-xs items-center"
          >
            <Text className="text-primary font-bold">Créer un compte</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const avatar = (user.image as string | null | undefined) ?? null;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 pt-2 pb-3">
          <View className="bg-surface-container-low rounded-2xl p-5">
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={changeAvatar}
                className="w-16 h-16 rounded-full bg-surface-container overflow-hidden items-center justify-center"
              >
                {savingAvatar ? (
                  <ActivityIndicator color="#2f6fb8" />
                ) : avatar ? (
                  <Image source={{ uri: avatar }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <Text className="text-outline text-xl">+</Text>
                )}
              </Pressable>
              <View className="flex-1">
                <Text className="text-on-surface text-lg font-bold">{user.companyName || user.name}</Text>
                <Text className="text-on-surface-variant text-xs">{user.email}</Text>
                {user.isPro && <Text className="text-primary text-xs font-bold mt-1">COMPTE PRO</Text>}
              </View>
            </View>
            {!user.emailVerified && (
              <View className="mt-3 bg-amber-100 px-3 py-2 rounded-lg">
                <Text className="text-amber-900 text-xs">Email non vérifié. Vérifiez votre boîte mail.</Text>
              </View>
            )}
          </View>
        </View>

        <View className="flex-row px-4 gap-2 mb-3">
          <TabBtn label={`Mes annonces (${mine.length})`} active={tab === "annonces"} onPress={() => setTab("annonces")} />
          <TabBtn label={`Favoris (${favorites.length})`} active={tab === "favoris"} onPress={() => setTab("favoris")} />
        </View>

        {busy ? (
          <View className="py-8 items-center"><ActivityIndicator color="#2f6fb8" /></View>
        ) : tab === "annonces" ? (
          <FlatList
            scrollEnabled={false}
            data={mine}
            keyExtractor={(l) => l.id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={
              <Text className="text-on-surface-variant text-center py-6">Aucune annonce publiée.</Text>
            }
            renderItem={({ item }) => <MineRow item={item} onPress={() => router.push(`/annonce/${item.id}`)} />}
          />
        ) : (
          <FlatList
            scrollEnabled={false}
            data={favorites}
            keyExtractor={(f) => f.id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={
              <Text className="text-on-surface-variant text-center py-6">Aucun favori.</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/annonce/${item.listing.id}`)}
                className="flex-row bg-surface-container-low rounded-xl overflow-hidden active:opacity-80"
              >
                <View className="w-20 h-20 bg-surface-container">
                  {firstImage(item.listing.images) && (
                    <Image
                      source={{ uri: firstImage(item.listing.images)! }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  )}
                </View>
                <View className="flex-1 p-2.5">
                  <Text numberOfLines={2} className="text-on-surface text-sm font-semibold">{item.listing.title}</Text>
                  <Text className="text-primary font-extrabold mt-0.5">{formatPrice(item.listing.price)}</Text>
                  <Text numberOfLines={1} className="text-on-surface-variant text-xs">{item.listing.location}</Text>
                </View>
              </Pressable>
            )}
          />
        )}

        <View className="px-4 mt-6">
          <Pressable onPress={logout} className="bg-red-50 border border-red-200 rounded-xl py-3 items-center">
            <Text className="text-red-600 font-semibold">Se déconnecter</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 py-2 rounded-full items-center ${active ? "bg-primary" : "bg-surface-container"}`}
    >
      <Text className={`text-sm font-semibold ${active ? "text-white" : "text-on-surface-variant"}`}>{label}</Text>
    </Pressable>
  );
}

function MineRow({ item, onPress }: { item: MineListing; onPress: () => void }) {
  const img = firstImage(item.images);
  const statusColor =
    item.status === "APPROVED" ? "bg-green-100 text-green-800" :
    item.status === "PENDING" ? "bg-amber-100 text-amber-900" :
    item.status === "REJECTED" ? "bg-red-100 text-red-800" :
    "bg-surface-container text-on-surface-variant";
  const statusLabel =
    item.status === "APPROVED" ? "En ligne" :
    item.status === "PENDING" ? "En attente" :
    item.status === "REJECTED" ? "Refusée" :
    item.status;
  return (
    <Pressable onPress={onPress} className="flex-row bg-surface-container-low rounded-xl overflow-hidden active:opacity-80">
      <View className="w-20 h-20 bg-surface-container">
        {img && <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
      </View>
      <View className="flex-1 p-2.5">
        <Text numberOfLines={1} className="text-on-surface font-semibold">{item.title}</Text>
        <Text className="text-primary font-extrabold mt-0.5">{formatPrice(item.price)}</Text>
        <View className="flex-row items-center gap-2 mt-1">
          <View className={`px-2 py-0.5 rounded-full ${statusColor.split(" ")[0]}`}>
            <Text className={`text-[10px] font-bold ${statusColor.split(" ")[1]}`}>{statusLabel}</Text>
          </View>
          <Text className="text-on-surface-variant text-xs">· {item.views} vues</Text>
        </View>
      </View>
    </Pressable>
  );
}

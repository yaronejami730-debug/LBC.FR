import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  Pressable,
  Dimensions,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatPrice, timeAgo } from "@/lib/format";

type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  category: string;
  subcategory?: string | null;
  condition?: string | null;
  images: string | string[] | null;
  createdAt: string;
  phone?: string | null;
  hidePhone?: boolean;
  userId: string;
  user?: { id: string; name: string; verified?: boolean; isPro?: boolean; companyName?: string | null };
};

type Favorite = { id: string; listing: { id: string } };

const SCREEN_W = Dimensions.get("window").width;

function parseImages(raw: string | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export default function AnnonceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);

  const loadFav = useCallback(async () => {
    if (!user || !id) return;
    try {
      const favs = await apiFetch<Favorite[]>("/api/favorites");
      setIsFav(favs.some((f) => f.listing.id === id));
    } catch {
      // silencieux : l'état favori reste à false
    }
  }, [user, id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await apiFetch<Listing>(`/api/listings/${id}`, { auth: false });
        setListing(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
    loadFav();
  }, [id, loadFav]);

  const toggleFav = async () => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    if (!listing || favBusy) return;
    setFavBusy(true);
    const next = !isFav;
    setIsFav(next);
    try {
      await apiFetch("/api/favorites", {
        method: next ? "POST" : "DELETE",
        body: JSON.stringify({ listingId: listing.id }),
      });
    } catch {
      setIsFav(!next);
      Alert.alert("Erreur", "Impossible de mettre à jour le favori.");
    } finally {
      setFavBusy(false);
    }
  };

  const contact = async () => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    if (!listing) return;
    if (listing.userId === user.id) {
      Alert.alert("Action impossible", "Vous ne pouvez pas vous contacter vous-même.");
      return;
    }
    setContactBusy(true);
    try {
      const conv = await apiFetch<{ id: string }>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ listingId: listing.id, sellerId: listing.userId }),
      });
      router.push(`/messages/${conv.id}`);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Impossible de démarrer la conversation");
    } finally {
      setContactBusy(false);
    }
  };

  if (loading) {
    return <View className="flex-1 bg-surface items-center justify-center"><ActivityIndicator color="#2f6fb8" /></View>;
  }
  if (error || !listing) {
    return (
      <View className="flex-1 bg-surface items-center justify-center px-6">
        <Text className="text-red-600 text-center mb-4">{error ?? "Annonce introuvable"}</Text>
        <Pressable onPress={() => router.back()} className="bg-primary px-4 py-2 rounded-full">
          <Text className="text-white font-semibold">Retour</Text>
        </Pressable>
      </View>
    );
  }

  const images = parseImages(listing.images);
  const sellerName = listing.user?.isPro && listing.user?.companyName ? listing.user.companyName : listing.user?.name;
  const isMine = user?.id === listing.userId;

  return (
    <>
      <Stack.Screen
        options={{
          title: listing.title,
          headerBackTitle: "Retour",
          headerRight: () =>
            !isMine ? (
              <Pressable onPress={toggleFav} disabled={favBusy} className="px-2">
                <Text className={isFav ? "text-2xl" : "text-2xl text-outline"}>{isFav ? "♥" : "♡"}</Text>
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ paddingBottom: 32 }}>
        {images.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {images.map((src, i) => (
              <Image
                key={i}
                source={{ uri: src }}
                style={{ width: SCREEN_W, height: SCREEN_W }}
                contentFit="cover"
              />
            ))}
          </ScrollView>
        ) : (
          <View style={{ width: SCREEN_W, height: SCREEN_W }} className="bg-surface-container items-center justify-center">
            <Text className="text-outline">Aucune photo</Text>
          </View>
        )}

        <View className="p-4">
          <Text className="text-primary text-3xl font-extrabold">{formatPrice(listing.price)}</Text>
          <Text className="text-on-surface text-xl font-bold mt-2">{listing.title}</Text>

          <View className="flex-row items-center mt-2 gap-3 flex-wrap">
            <Text className="text-on-surface-variant text-sm">{listing.location}</Text>
            <Text className="text-on-surface-variant text-sm">•</Text>
            <Text className="text-on-surface-variant text-sm">{timeAgo(listing.createdAt)}</Text>
          </View>

          <View className="mt-3 flex-row gap-2 flex-wrap">
            <View className="bg-surface-container px-3 py-1 rounded-full">
              <Text className="text-on-surface-variant text-xs font-semibold">{listing.category}</Text>
            </View>
            {listing.subcategory && (
              <View className="bg-surface-container px-3 py-1 rounded-full">
                <Text className="text-on-surface-variant text-xs font-semibold">{listing.subcategory}</Text>
              </View>
            )}
            {listing.condition && (
              <View className="bg-surface-container px-3 py-1 rounded-full">
                <Text className="text-on-surface-variant text-xs font-semibold">{listing.condition}</Text>
              </View>
            )}
          </View>

          <View className="mt-6">
            <Text className="text-on-surface text-base font-bold mb-2">Description</Text>
            <Text className="text-on-surface text-sm leading-relaxed">{listing.description}</Text>
          </View>

          {sellerName && (
            <View className="mt-6 bg-surface-container-low rounded-2xl p-4">
              <Text className="text-on-surface-variant text-xs uppercase tracking-wider font-semibold mb-1">Vendeur</Text>
              <Text className="text-on-surface text-base font-bold">{sellerName}</Text>
              {listing.user?.isPro && <Text className="text-primary text-xs font-bold mt-1">PROFESSIONNEL</Text>}
              {listing.user?.verified && <Text className="text-green-600 text-xs font-semibold mt-1">✓ Identité vérifiée</Text>}
            </View>
          )}

          {!isMine && (
            <View className="mt-6 gap-3">
              <Pressable
                onPress={contact}
                disabled={contactBusy}
                className="bg-primary py-3.5 rounded-full items-center active:opacity-80"
              >
                {contactBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold">Envoyer un message</Text>
                )}
              </Pressable>
              {listing.phone && !listing.hidePhone && (
                <Pressable className="border border-primary py-3.5 rounded-full items-center active:opacity-80">
                  <Text className="text-primary font-bold">{listing.phone}</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

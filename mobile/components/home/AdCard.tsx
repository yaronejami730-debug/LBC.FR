import { View, Text, Pressable, Linking } from "react-native";
import { Image } from "expo-image";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";

export type Ad = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageUrlWide: string | null;
  destinationUrl: string;
};

function track(id: string, type: "click" | "impression") {
  apiFetch("/api/ads/track", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ id, type, placement: "grid" }),
  }).catch(() => {});
}

export default function AdCard({ ad, width = 160 }: { ad: Ad; width?: number }) {
  const img = ad.imageUrl?.startsWith("http") ? ad.imageUrl : `${API_BASE_URL}${ad.imageUrl}`;
  return (
    <Pressable
      onPress={() => {
        track(ad.id, "click");
        Linking.openURL(ad.destinationUrl).catch(() => {});
      }}
      style={{ width }}
      className="active:opacity-80"
    >
      <View className="bg-surface-container-low rounded-xl overflow-hidden border border-surface-container">
        <View style={{ width: "100%", aspectRatio: 1 }} className="bg-surface-container">
          <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} />
          <View className="absolute top-2 left-2 bg-primary px-2 py-0.5 rounded-full">
            <Text className="text-white text-[10px] font-bold uppercase">Pub</Text>
          </View>
        </View>
        <View className="px-2 pt-2 pb-3">
          <Text numberOfLines={2} className="text-on-surface text-sm font-semibold leading-snug">{ad.title}</Text>
          <Text numberOfLines={1} className="text-on-surface-variant text-xs mt-1">{ad.description}</Text>
        </View>
      </View>
    </Pressable>
  );
}

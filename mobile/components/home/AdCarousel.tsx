import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { Image } from "expo-image";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";

type Ad = {
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
    body: JSON.stringify({ id, type, placement: "carousel" }),
  }).catch(() => {});
}

export default function AdCarousel({ ads: adsProp }: { ads?: Ad[] }) {
  const [adsState, setAdsState] = useState<Ad[]>([]);
  const ads = adsProp ?? adsState;
  const [current, setCurrent] = useState(0);
  const fired = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (adsProp) return;
    apiFetch<Ad[]>("/api/ads", { auth: false })
      .then(setAdsState)
      .catch(() => setAdsState([]));
  }, [adsProp]);

  useEffect(() => {
    if (ads.length <= 1) return;
    const t = setInterval(() => setCurrent((p) => (p + 1) % ads.length), 8000);
    return () => clearInterval(t);
  }, [ads.length]);

  useEffect(() => {
    const ad = ads[current];
    if (!ad?.id || fired.current[ad.id]) return;
    fired.current[ad.id] = true;
    track(ad.id, "impression");
  }, [current, ads]);

  if (ads.length === 0) return null;
  const ad = ads[current % ads.length];
  const img = ad.imageUrl?.startsWith("http") ? ad.imageUrl : `${API_BASE_URL}${ad.imageUrl}`;

  return (
    <View className="mt-3">
      <Pressable
        onPress={() => {
          track(ad.id, "click");
          Linking.openURL(ad.destinationUrl).catch(() => {});
        }}
        className="flex-row items-center bg-surface-container-low border border-surface-container rounded-2xl p-3 active:opacity-80"
      >
        <View className="w-20 h-20 rounded-xl overflow-hidden bg-surface-container mr-3">
          <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          <View className="absolute top-1 left-1 bg-primary px-1.5 py-0.5 rounded-full">
            <Text className="text-white text-[8px] font-bold uppercase">Pub</Text>
          </View>
        </View>
        <View className="flex-1">
          <Text className="text-on-surface font-bold text-sm" numberOfLines={1}>{ad.title}</Text>
          <Text className="text-on-surface-variant text-xs mt-0.5" numberOfLines={2}>{ad.description}</Text>
        </View>
      </Pressable>
      {ads.length > 1 && (
        <View className="flex-row justify-center gap-1 mt-2">
          {ads.map((_, i) => (
            <View key={i} className={`w-1.5 h-1.5 rounded-full ${i === current ? "bg-primary" : "bg-surface-container"}`} />
          ))}
        </View>
      )}
    </View>
  );
}

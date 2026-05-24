import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, Linking, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
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

const LAST_KEY = "dealandco.interstitial.last";
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h
const { width: W } = Dimensions.get("window");

function track(id: string, type: "click" | "impression") {
  apiFetch("/api/ads/track", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ id, type, placement: "interstitial" }),
  }).catch(() => {});
}

export default function InterstitialAd() {
  const [ad, setAd] = useState<Ad | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const last = await SecureStore.getItemAsync(LAST_KEY);
        if (last && Date.now() - parseInt(last) < COOLDOWN_MS) return;
        const res = await apiFetch<Ad | null>("/api/ads/interstitial", { auth: false });
        if (!res) return;
        setAd(res);
        setVisible(true);
        track(res.id, "impression");
        SecureStore.setItemAsync(LAST_KEY, String(Date.now())).catch(() => {});
      } catch {
        // silencieux
      }
    })();
  }, []);

  if (!ad) return null;

  const img = ad.imageUrlWide ?? ad.imageUrl;
  const imgUri = img.startsWith("http") ? img : `${API_BASE_URL}${img}`;
  const close = () => setVisible(false);
  const open = () => {
    track(ad.id, "click");
    Linking.openURL(ad.destinationUrl).catch(() => {});
    close();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={close}>
      <View className="flex-1 bg-black/90 items-center justify-center">
        {/* Croix top right */}
        <Pressable
          onPress={close}
          hitSlop={16}
          className="absolute top-14 right-5 w-10 h-10 rounded-full bg-white items-center justify-center z-10"
        >
          <Ionicons name="close" size={22} color="#1a1a1a" />
        </Pressable>

        {/* Carte pub */}
        <Pressable onPress={open} className="w-full" style={{ maxWidth: W }}>
          <View className="bg-white">
            <Image
              source={{ uri: imgUri }}
              style={{ width: W, height: W * 0.95 }}
              contentFit="cover"
            />
            <View className="p-5">
              <Text className="text-on-surface text-2xl font-extrabold leading-tight">{ad.title}</Text>
              <Text className="text-on-surface-variant text-sm mt-2 leading-relaxed">{ad.description}</Text>
              <View className="bg-[#e8632a] rounded-full py-3 items-center mt-5">
                <Text className="text-white font-bold">Je découvre</Text>
              </View>
            </View>
          </View>
        </Pressable>

        <Text className="text-white/50 text-[10px] font-bold uppercase tracking-wider mt-4">Publicité</Text>
      </View>
    </Modal>
  );
}

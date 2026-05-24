import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";

type Banner = {
  title: string;
  subtitle: string | null;
  bgFrom: string;
  bgTo: string;
  bgImage: string | null;
  textColor: string;
  showText: boolean;
};

const DEFAULT_TITLE = "Petites annonces gratuites entre particuliers";
const DEFAULT_SUBTITLE = "Publiez en 2 minutes. Sans commission, contact direct.";

function PublishButton({ color }: { color: string }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/(tabs)/post")}
      className="bg-white px-5 py-2.5 rounded-full active:opacity-80 self-start mt-4"
    >
      <Text className="font-bold text-sm" style={{ color }}>
        Publier mon annonce
      </Text>
    </Pressable>
  );
}

export default function HeroBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [ratio, setRatio] = useState(16 / 9);

  useEffect(() => {
    apiFetch<Banner | null>("/api/hero-banner", { auth: false })
      .then(setBanner)
      .catch(() => setBanner(null));
  }, []);

  const bgImageUri = banner?.bgImage
    ? banner.bgImage.startsWith("http")
      ? banner.bgImage
      : `${API_BASE_URL}${banner.bgImage}`
    : null;

  // Variante photo : l'image dicte le ratio ; texte superposé si showText.
  if (bgImageUri) {
    return (
      <View className="rounded-2xl overflow-hidden mt-2">
        <Image
          source={{ uri: bgImageUri }}
          style={{ width: "100%", aspectRatio: ratio }}
          contentFit="cover"
          onLoad={(e) => {
            const { width, height } = e.source;
            if (width && height) setRatio(width / height);
          }}
        />
        {banner?.showText && (
          <View className="absolute inset-0 bg-black/35 p-5 justify-end">
            <Text className="text-white text-2xl font-extrabold leading-tight" style={{ color: banner.textColor }}>
              {banner.title}
            </Text>
            {banner.subtitle ? (
              <Text className="text-white/90 text-sm mt-2 leading-relaxed" style={{ color: banner.textColor }}>
                {banner.subtitle}
              </Text>
            ) : null}
            <PublishButton color={banner.bgFrom} />
          </View>
        )}
      </View>
    );
  }

  // Variante dégradé.
  const title = banner?.title ?? DEFAULT_TITLE;
  const subtitle = banner ? banner.subtitle : DEFAULT_SUBTITLE;
  const textColor = banner?.textColor ?? "#ffffff";
  const from = banner?.bgFrom ?? "#2f6fb8";
  const to = banner?.bgTo ?? "#1a5a9e";

  return (
    <LinearGradient
      colors={[from, to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="rounded-2xl overflow-hidden mt-2"
    >
      <View className="p-5">
        <Text className="text-2xl font-extrabold leading-tight" style={{ color: textColor }}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-sm mt-2 leading-relaxed" style={{ color: textColor, opacity: 0.9 }}>
            {subtitle}
          </Text>
        ) : null}
        <PublishButton color={from} />
      </View>
    </LinearGradient>
  );
}

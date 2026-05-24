import { View, Text, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import ListingCard, { type HomeListing } from "./ListingCard";
import AdCard, { type Ad } from "./AdCard";

type Props = {
  title: string;
  subtitle?: string;
  listings: HomeListing[];
  badge?: string;
  seeAllHref?: Href;
  ad?: Ad | null;
};

export default function ListingRow({ title, subtitle, listings, badge, seeAllHref, ad }: Props) {
  const router = useRouter();
  if (!listings || listings.length === 0) return null;

  // Insère une carte pub après la 3e annonce (ou à la fin si moins de 3).
  const adIndex = Math.min(3, listings.length);

  return (
    <View className="mt-6">
      <View className="px-4 mb-3 flex-row items-end justify-between">
        <View className="flex-1">
          <Text className="text-on-surface text-lg font-bold">{title}</Text>
          {subtitle && <Text className="text-on-surface-variant text-xs mt-0.5">{subtitle}</Text>}
        </View>
        {seeAllHref && (
          <Pressable onPress={() => router.push(seeAllHref)} className="flex-row items-center active:opacity-70 ml-2">
            <Text className="text-primary font-semibold text-sm">Voir tout</Text>
            <Ionicons name="chevron-forward" size={16} color="#2f6fb8" />
          </Pressable>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {listings.map((l, i) => (
          <View key={l.id} className="flex-row" style={{ gap: 10 }}>
            {ad && i === adIndex && <AdCard ad={ad} />}
            <ListingCard listing={l} badge={badge} />
          </View>
        ))}
        {ad && listings.length < 3 && <AdCard ad={ad} />}
      </ScrollView>
    </View>
  );
}

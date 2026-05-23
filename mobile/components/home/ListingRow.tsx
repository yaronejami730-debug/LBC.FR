import { View, Text, ScrollView } from "react-native";
import ListingCard, { type HomeListing } from "./ListingCard";

type Props = {
  title: string;
  subtitle?: string;
  listings: HomeListing[];
  badge?: string;
};

export default function ListingRow({ title, subtitle, listings, badge }: Props) {
  if (!listings || listings.length === 0) return null;
  return (
    <View className="mt-6">
      <View className="px-4 mb-3">
        <Text className="text-on-surface text-lg font-bold">{title}</Text>
        {subtitle && <Text className="text-on-surface-variant text-xs mt-0.5">{subtitle}</Text>}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {listings.map((l) => (
          <ListingCard key={l.id} listing={l} badge={badge} />
        ))}
      </ScrollView>
    </View>
  );
}

import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { formatPrice, firstImage } from "@/lib/format";
import { radius } from "@/lib/theme";
import Card from "@/components/ui/Card";
import GlassBadge from "@/components/ui/GlassBadge";

export type HomeListing = {
  id: string;
  title: string;
  price: number | string;
  location: string;
  images: string | string[] | null;
  createdAt: string | Date;
  isPremium?: boolean;
};

type Props = {
  listing: HomeListing;
  width?: number;
  badge?: string;
};

function ListingCard({ listing, width = 168, badge }: Props) {
  const router = useRouter();
  const img = firstImage(listing.images);

  return (
    <Pressable
      onPress={() => router.push(`/annonce/${listing.id}`)}
      style={{ width }}
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${formatPrice(listing.price)}`}
      className="active:opacity-80"
    >
      <Card clip>
        <View style={{ width: "100%", aspectRatio: 1 }} className="bg-surface-container">
          {img ? (
            <Image
              source={{ uri: img }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
              recyclingKey={listing.id}
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-outline text-xs">Aucune photo</Text>
            </View>
          )}

          {listing.isPremium && (
            <View className="absolute top-2 left-2 bg-primary px-2.5 py-1 rounded-full">
              <Text className="text-white text-[10px] font-bold uppercase">Premium</Text>
            </View>
          )}
          {badge && (
            <View className="absolute top-2 right-2 bg-navy px-2.5 py-1 rounded-full">
              <Text className="text-white text-[10px] font-bold uppercase">{badge}</Text>
            </View>
          )}

          {/* Overlay glassmorphism : réservé au-dessus de l'image. */}
          {!!listing.location && img && (
            <GlassBadge
              icon="location-outline"
              label={listing.location}
              style={{ position: "absolute", left: 8, bottom: 8, maxWidth: width - 16 }}
            />
          )}
        </View>

        <View className="px-3 pt-2.5 pb-3.5" style={{ borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg }}>
          <Text numberOfLines={2} className="text-on-surface text-sm font-bold leading-snug">
            {listing.title}
          </Text>
          <Text className="text-primary text-lg font-extrabold mt-1">{formatPrice(listing.price)}</Text>
          {!img && !!listing.location && (
            <Text numberOfLines={1} className="text-on-surface-variant text-xs mt-0.5">
              {listing.location}
            </Text>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

export default memo(ListingCard);

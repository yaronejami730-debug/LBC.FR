import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { formatPrice, firstImage } from "@/lib/format";

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

function ListingCard({ listing, width = 160, badge }: Props) {
  const router = useRouter();
  const img = firstImage(listing.images);

  return (
    <Pressable
      onPress={() => router.push(`/annonce/${listing.id}`)}
      style={{ width }}
      className="active:opacity-80"
    >
      <View className="bg-surface-container-low rounded-xl overflow-hidden">
        <View style={{ width: "100%", aspectRatio: 1 }} className="bg-surface-container">
          {img ? (
            <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} cachePolicy="memory-disk" recyclingKey={listing.id} />
          ) : (
            <View className="flex-1 items-center justify-center"><Text className="text-outline text-xs">Aucune photo</Text></View>
          )}
          {listing.isPremium && (
            <View className="absolute top-2 left-2 bg-primary px-2 py-0.5 rounded-full">
              <Text className="text-white text-[10px] font-bold uppercase">Premium</Text>
            </View>
          )}
          {badge && (
            <View className="absolute top-2 right-2 bg-bargain px-2 py-0.5 rounded-full">
              <Text className="text-white text-[10px] font-bold uppercase">{badge}</Text>
            </View>
          )}
        </View>
        <View className="px-2 pt-2 pb-3">
          <Text numberOfLines={2} className="text-on-surface text-sm font-semibold leading-snug">{listing.title}</Text>
          <Text className="text-primary text-base font-extrabold mt-1">{formatPrice(listing.price)}</Text>
          <Text numberOfLines={1} className="text-on-surface-variant text-xs mt-0.5">{listing.location}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default memo(ListingCard);

import { memo, useState } from "react";
import { View, Text, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { formatPrice, allImages, timeAgo } from "@/lib/format";
import { colors } from "@/lib/theme";

export type SearchListing = {
  id: string;
  title: string;
  price: number | string;
  location: string;
  images: string | string[] | null;
  createdAt: string;
  condition?: string | null;
  vehicleKm?: number | null;
  vehicleYear?: number | null;
  isPremium?: boolean;
  user?: { name: string; verified?: boolean; isPro?: boolean; companyName?: string | null; avatar?: string | null };
};

type Props = {
  listing: SearchListing;
  favorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
};

/**
 * Ligne de résultat de recherche.
 *
 * Format volontairement plat : l'image occupe une bande large et courte, pas
 * un carré, pour qu'une liste montre plusieurs annonces d'un coup d'œil. Les
 * photos se feuillettent sur place — ouvrir la fiche pour voir la deuxième
 * photo faisait perdre le fil de la liste.
 */
function SearchListingCard({ listing, favorite, onPress, onToggleFavorite }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = allImages(listing.images);
  // Largeur utile : la liste est posée dans un conteneur à 12 px de marge.
  const cardWidth = screenWidth - 24;
  const imageHeight = Math.round(cardWidth / 2.2);

  const seller = listing.user?.isPro && listing.user?.companyName ? listing.user.companyName : listing.user?.name;
  const specs = [
    listing.vehicleYear,
    listing.vehicleKm ? `${listing.vehicleKm.toLocaleString("fr-FR")} km` : null,
    listing.condition,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${formatPrice(listing.price)}`}
      className="bg-surface border border-line rounded-card overflow-hidden active:opacity-90"
    >
      <View style={{ width: "100%", height: imageHeight }} className="bg-surface-container">
        {photos.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / cardWidth))
            }
            scrollEventThrottle={16}
          >
            {photos.map((uri, i) => (
              <Image
                key={`${listing.id}-${i}`}
                source={{ uri }}
                style={{ width: cardWidth, height: imageHeight }}
                contentFit="cover"
                transition={120}
                cachePolicy="memory-disk"
                recyclingKey={`${listing.id}-${i}`}
              />
            ))}
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-outline text-xs">Aucune photo</Text>
          </View>
        )}

        {listing.isPremium && (
          <View className="absolute top-2.5 left-2.5 bg-navy px-2.5 py-1 rounded-full">
            <Text className="text-white text-[10px] font-bold uppercase">À la une</Text>
          </View>
        )}

        <Pressable
          onPress={onToggleFavorite}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-surface items-center justify-center"
        >
          <Ionicons
            name={favorite ? "heart" : "heart-outline"}
            size={19}
            color={favorite ? colors.danger : colors.onSurface}
          />
        </Pressable>

        {photos.length > 1 && (
          <View className="absolute left-0 right-0 bottom-2 flex-row justify-center gap-1.5">
            {photos.map((_, i) => (
              <View
                key={i}
                style={{ opacity: i === photoIndex ? 1 : 0.45 }}
                className="w-1.5 h-1.5 rounded-full bg-surface"
              />
            ))}
          </View>
        )}
      </View>

      <View className="px-3 py-2.5">
        <Text className="text-on-surface text-[15px] font-bold" numberOfLines={1}>
          {listing.title}
        </Text>
        <View className="flex-row items-center mt-0.5">
          <Text className="text-primary text-lg font-extrabold">{formatPrice(listing.price)}</Text>
          {listing.user?.isPro && (
            <View className="border border-primary rounded-full px-2 py-0.5 ml-2">
              <Text className="text-primary text-[10px] font-bold">Pro</Text>
            </View>
          )}
        </View>
        {specs ? (
          <Text className="text-on-surface-variant text-xs mt-0.5" numberOfLines={1}>
            {specs}
          </Text>
        ) : null}
        <Text className="text-on-surface-variant text-xs mt-0.5" numberOfLines={1}>
          {[seller ? `Par ${seller}` : null, listing.location, timeAgo(listing.createdAt)]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}

export default memo(SearchListingCard);

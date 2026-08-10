import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { colors } from "@/lib/theme";
import { useGoBack } from "@/lib/navigation";

type Props = {
  /** Écran de repli quand il n'y a rien à dépiler (deep link, notification). */
  fallback?: Href;
  color?: string;
};

/**
 * Bouton retour à cible tactile large (44 pt via hitSlop), utilisable comme
 * `headerLeft` ou dans une barre de titre maison.
 */
export default function BackButton({ fallback, color = colors.onSurface }: Props) {
  const goBack = useGoBack(fallback ?? "/(tabs)");
  return (
    <Pressable
      onPress={goBack}
      hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
      accessibilityRole="button"
      accessibilityLabel="Retour"
      className="pr-2 py-1 active:opacity-60"
    >
      <Ionicons name="chevron-back" size={26} color={color} />
    </Pressable>
  );
}

import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, glass } from "@/lib/theme";

type Props = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

/**
 * Badge glassmorphism — bleu marine 60 % + liseré blanc, à poser sur une image
 * uniquement (jamais sur fond uni). Ex. nombre de vues, favoris.
 *
 * Le vrai flou demanderait expo-blur (non installé) ; l'opacité + le liseré
 * donnent le même rendu sur photo.
 */
export default function GlassBadge({ label, icon, style }: Props) {
  return (
    <View
      style={[
        { backgroundColor: glass.backgroundColor, borderColor: glass.borderColor, borderWidth: 1 },
        style,
      ]}
      className="flex-row items-center rounded-full px-2.5 py-1"
    >
      {icon && <Ionicons name={icon} size={12} color={colors.white} style={{ marginRight: 4 }} />}
      <Text numberOfLines={1} className="text-white text-[11px] font-bold flex-shrink">
        {label}
      </Text>
    </View>
  );
}

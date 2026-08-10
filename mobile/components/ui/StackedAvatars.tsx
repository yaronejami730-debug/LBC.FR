import { Text, View } from "react-native";
import Avatar from "./Avatar";
import { colors } from "@/lib/theme";

type Person = { name?: string | null; uri?: string | null };

type Props = {
  people: Person[];
  /** Au-delà, un cercle "+N" ferme la pile. */
  max?: number;
  size?: number;
  /** Texte à droite de la pile, ex. "12 personnes intéressées". */
  caption?: string;
};

/** Cercles chevauchés à contour blanc — engagement sur une annonce. */
export default function StackedAvatars({ people, max = 4, size = 28, caption }: Props) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const overlap = Math.round(size * 0.32);

  return (
    <View className="flex-row items-center">
      <View className="flex-row">
        {shown.map((p, i) => (
          <View key={i} style={{ marginLeft: i === 0 ? 0 : -overlap, zIndex: shown.length - i }}>
            <Avatar name={p.name} uri={p.uri} size={size} ring />
          </View>
        ))}
        {extra > 0 && (
          <View
            style={{
              marginLeft: -overlap,
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 2,
              borderColor: colors.white,
            }}
            className="bg-primary-light items-center justify-center"
          >
            <Text className="text-primary font-bold" style={{ fontSize: size * 0.3 }}>
              +{extra}
            </Text>
          </View>
        )}
      </View>
      {caption && <Text className="text-on-surface-variant text-xs ml-2">{caption}</Text>}
    </View>
  );
}

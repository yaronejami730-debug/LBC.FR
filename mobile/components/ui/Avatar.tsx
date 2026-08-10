import { Text, View } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/lib/theme";

type Props = {
  /** Nom complet ou pseudo — sert à dériver les initiales. */
  name?: string | null;
  uri?: string | null;
  size?: number;
  /** Contour blanc 2 px — utile sur photo ou en pile. */
  ring?: boolean;
};

export function initialsOf(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Cercle bleu marine à initiales blanches, ou photo si fournie. */
export default function Avatar({ name, uri, size = 40, ring = false }: Props) {
  const box = {
    width: size,
    height: size,
    borderRadius: size / 2,
    ...(ring ? { borderWidth: 2, borderColor: colors.white } : null),
  };

  if (uri) {
    return (
      <View style={box} className="overflow-hidden bg-surface-container">
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} />
      </View>
    );
  }

  return (
    <View style={box} className="bg-navy items-center justify-center">
      <Text className="text-white font-bold" style={{ fontSize: size * 0.36 }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Place l'icône après le label. */
  iconRight?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** Occupe toute la largeur disponible. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

const CONTAINER: Record<Variant, string> = {
  primary: "bg-primary",
  secondary: "bg-surface border border-primary",
  ghost: "bg-transparent",
  danger: "bg-danger",
};

const LABEL: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-primary",
  ghost: "text-primary",
  danger: "text-white",
};

const ICON_COLOR: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.primary,
  ghost: colors.primary,
  danger: colors.white,
};

const PADDING: Record<Size, string> = {
  sm: "px-4 py-2",
  md: "px-5 py-3",
  lg: "px-6 py-4",
};

const TEXT_SIZE: Record<Size, string> = {
  sm: "text-sm",
  md: "text-[15px]",
  lg: "text-base",
};

const ICON_SIZE: Record<Size, number> = { sm: 15, md: 17, lg: 19 };

/** Bouton pill du design system — primaire bleu plein, secondaire bordé, ghost texte seul. */
export default function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconRight = false,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: Props) {
  const inert = disabled || loading;
  const glyph = icon ? (
    <Ionicons name={icon} size={ICON_SIZE[size]} color={inert ? colors.outline : ICON_COLOR[variant]} />
  ) : null;

  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      style={style}
      className={[
        "flex-row items-center justify-center rounded-full active:opacity-80",
        CONTAINER[variant],
        PADDING[size],
        fullWidth ? "w-full" : "self-start",
        inert ? "opacity-50" : "",
      ].join(" ")}
    >
      {loading ? (
        <ActivityIndicator size="small" color={ICON_COLOR[variant]} />
      ) : (
        <View className="flex-row items-center">
          {glyph && !iconRight && <View className="mr-2">{glyph}</View>}
          <Text className={`font-bold ${LABEL[variant]} ${TEXT_SIZE[size]}`}>{label}</Text>
          {glyph && iconRight && <View className="ml-2">{glyph}</View>}
        </View>
      )}
    </Pressable>
  );
}

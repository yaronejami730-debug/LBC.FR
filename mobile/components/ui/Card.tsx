import { View, type StyleProp, type ViewStyle } from "react-native";
import { cardShadow, radius } from "@/lib/theme";

type Props = {
  children: React.ReactNode;
  /** Coupe le contenu aux coins arrondis — nécessaire si une image touche les bords. */
  clip?: boolean;
  /** Ombre douce plutôt que bordure fine. */
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  className?: string;
};

/** Card blanche à coins très arrondis, posée sur le fond off-white de l'app. */
export default function Card({ children, clip = false, elevated = true, style, className = "" }: Props) {
  return (
    <View
      style={[
        { borderRadius: radius.lg },
        elevated ? cardShadow : null,
        clip ? { overflow: "hidden" } : null,
        style,
      ]}
      className={`bg-surface ${elevated ? "" : "border border-line"} ${className}`}
    >
      {children}
    </View>
  );
}

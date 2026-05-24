import { useEffect, useRef } from "react";
import { Animated, View, type ViewStyle } from "react-native";

type Props = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

/** Bloc gris animé (pulse) — placeholder à utiliser en lieu et place d'un spinner. */
export function Skeleton({ width = "100%", height = 16, borderRadius = 8, style }: Props) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width: width as number | `${number}%`, height, borderRadius, backgroundColor: "#e5e7eb", opacity },
        style,
      ]}
    />
  );
}

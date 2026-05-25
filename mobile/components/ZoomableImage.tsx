import { useState } from "react";
import { View, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

type Props = {
  uri: string;
  width: number;
  height: number;
  style?: ViewStyle;
  /** Couleur de fond derrière l'image (letterbox). Blanc par défaut. */
  background?: string;
};

/** Image avec pinch-to-zoom + double-tap + pan quand zoomée. */
export function ZoomableImage({ uri, width, height, style, background = "#fff" }: Props) {
  // Le pan ne capture le geste QUE lorsqu'on est zoomé : sinon il bloquerait
  // le scroll vertical de la liste parente.
  const [zoomed, setZoomed] = useState(false);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const reset = () => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedScale.value = 1;
    savedX.value = 0;
    savedY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = savedScale.value * e.scale;
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        reset();
        runOnJS(setZoomed)(false);
      } else {
        runOnJS(setZoomed)(true);
      }
    });

  const pan = Gesture.Pan()
    .enabled(zoomed)
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
        runOnJS(setZoomed)(false);
      } else {
        scale.value = withSpring(2);
        savedScale.value = 2;
        runOnJS(setZoomed)(true);
      }
    });

  const composed = Gesture.Simultaneous(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <View style={[{ width, height, overflow: "hidden", backgroundColor: background }, style]}>
        <Animated.View style={[{ width, height }, animStyle]}>
          <Image
            source={{ uri }}
            style={{ width, height }}
            contentFit="contain"
            transition={100}
            cachePolicy="memory-disk"
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Signature Deal&Co apposée sur les photos d'annonce.
 *
 * En bas à gauche, en blanc, en transparence — la convention des sites
 * d'annonces : la photo reste lisible, mais elle n'est plus réutilisable telle
 * quelle ailleurs sans que l'origine se voie.
 *
 * Le fond n'est pas toujours une photo. Dans la visionneuse plein écran,
 * `ZoomableImage` affiche en `contain` sur du blanc : une photo non carrée est
 * letterboxée et le coin bas-gauche tombe sur le fond blanc de la carte. Du
 * texte blanc avec une simple ombre y devenait invisible. D'où le voile
 * dégradé sombre posé sous la signature — il s'efface vers le haut et vers la
 * droite, donc il se lit comme une ombre de coin et pas comme un bandeau.
 *
 * Le filigrane est purement visuel : il est dessiné au-dessus de l'image, pas
 * incrusté dedans. Une photo enregistrée depuis la pellicule ne le portera pas.
 * L'incrustation réelle se ferait au téléversement, côté serveur.
 */
export function PhotoWatermark({
  size = "md",
  style,
}: {
  /** `sm` pour une vignette, `md` pour une photo pleine largeur. */
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
}) {
  const fontSize = size === "sm" ? 11 : 15;
  const inset = size === "sm" ? 8 : 12;
  // Le voile déborde largement du texte, sinon sa limite se voit.
  const scrimW = size === "sm" ? 110 : 150;
  const scrimH = size === "sm" ? 46 : 62;

  return (
    <View
      pointerEvents="none"
      style={[{ position: "absolute", left: 0, bottom: 0 }, style]}
    >
      <LinearGradient
        // Diagonale : opaque au coin bas-gauche, transparent vers le haut à droite.
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        colors={["rgba(0,0,0,0.42)", "rgba(0,0,0,0.16)", "transparent"]}
        locations={[0, 0.45, 1]}
        style={{ width: scrimW, height: scrimH }}
      />
      <Text
        style={{
          position: "absolute",
          left: inset,
          bottom: inset,
          color: "#ffffff",
          fontSize,
          fontWeight: "800",
          letterSpacing: -0.3,
          opacity: 0.92,
          textShadowColor: "rgba(0,0,0,0.55)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
        }}
      >
        Deal&Co
      </Text>
    </View>
  );
}

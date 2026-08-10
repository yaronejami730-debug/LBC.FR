import { cloneElement, type ReactElement } from "react";
import { StyleSheet, Text, TextInput, type TextStyle } from "react-native";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";

/** Fichiers à passer à useFonts() dans le layout racine. */
export const interFonts = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
};

/**
 * Inter est chargée en statique (un fichier par graisse) : `fontWeight` ne
 * sélectionne pas la bonne fonte tout seul, il faut mapper poids → famille.
 * Sinon Android fabrique un faux gras et iOS reste en Regular.
 */
const FAMILY_BY_WEIGHT: Record<string, string> = {
  "100": "Inter_400Regular",
  "200": "Inter_400Regular",
  "300": "Inter_400Regular",
  "400": "Inter_400Regular",
  normal: "Inter_400Regular",
  "500": "Inter_500Medium",
  "600": "Inter_600SemiBold",
  "700": "Inter_700Bold",
  bold: "Inter_700Bold",
  "800": "Inter_800ExtraBold",
  "900": "Inter_800ExtraBold",
};

function resolve(style: TextStyle | undefined): TextStyle {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  // Une famille explicitement demandée par l'appelant reste prioritaire.
  if (flat.fontFamily) return flat;
  const weight = flat.fontWeight != null ? String(flat.fontWeight) : "400";
  return {
    ...flat,
    fontFamily: FAMILY_BY_WEIGHT[weight] ?? "Inter_400Regular",
    // La graisse est déjà portée par le fichier ; la laisser déclencherait un
    // faux gras par-dessus sur Android.
    fontWeight: undefined,
  };
}

let patched = false;

/**
 * Applique Inter à tous les <Text> et <TextInput> de l'app.
 *
 * React Native n'hérite pas la typographie : sans ce patch il faudrait poser
 * fontFamily sur chaque composant. On enveloppe donc le render des primitives
 * une seule fois, après le chargement des fontes.
 */
export function applyInterDefaults() {
  if (patched) return;
  patched = true;

  for (const Component of [Text, TextInput] as unknown as {
    render?: (...args: unknown[]) => ReactElement<{ style?: TextStyle }>;
  }[]) {
    const original = Component.render;
    if (typeof original !== "function") continue;
    Component.render = function patchedRender(...args: unknown[]) {
      const element = original.apply(this, args);
      return cloneElement(element, { style: resolve(element.props?.style) });
    };
  }
}

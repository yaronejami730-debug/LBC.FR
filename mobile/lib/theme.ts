/**
 * Design system Deal&Company — source de vérité des tokens.
 *
 * Palette bicolore : bleu + blanc. Aucun orange, aucun accent tiers.
 * Les classes NativeWind (bg-primary, text-on-surface…) sont mappées sur ces
 * mêmes valeurs dans tailwind.config.js. Ce fichier sert aux APIs qui
 * n'acceptent pas de className : Ionicons, Tabs, StatusBar, LinearGradient,
 * MapView, ActivityIndicator, styles inline.
 */

export const colors = {
  /** Bleu primaire — marque, CTA, prix, état actif. */
  primary: "#1046D6",
  /** Bleu primaire assombri — pressed / gradient. */
  primaryDark: "#0C36A8",
  /** Bleu pâle — fonds de section, tags, hover. */
  primaryLight: "#E8EEFC",
  /** Bleu marine — fonds sombres, overlays, segmented control actif. */
  navy: "#0B1E4D",

  /** Blanc — cards, feuilles, barres. */
  surface: "#FFFFFF",
  /** Fond d'app off-white — fait ressortir les cards blanches. */
  app: "#F7F8FA",
  /** Gris de remplissage — champs, placeholders image, piste du segmented. */
  surfaceContainer: "#F1F2F5",

  /** Texte principal. */
  onSurface: "#101A33",
  /** Texte secondaire. */
  onSurfaceVariant: "#6B7488",
  /** Texte désactivé / icônes inertes. */
  outline: "#98A0B3",
  /** Bordures et séparateurs. */
  line: "#E4E7EC",

  /** Succès, discret. */
  success: "#2E9E8F",
  /** Erreur. */
  danger: "#D6432F",

  white: "#FFFFFF",
} as const;

/** Rayons généreux — règle du design system. */
export const radius = {
  sm: 10,
  md: 16,
  /** Cards. */
  lg: 22,
  /** Sheets, gros blocs. */
  xl: 28,
  /** Pills, boutons, segmented control. */
  pill: 999,
} as const;

/** Overlay glassmorphism — réservé aux badges posés sur une image. */
export const glass = {
  backgroundColor: "rgba(11, 30, 77, 0.6)",
  borderColor: "rgba(255, 255, 255, 0.18)",
} as const;

/** Ombre douce des cards blanches sur fond off-white. */
export const cardShadow = {
  shadowColor: "#0B1E4D",
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

/**
 * Échelle typographique. Les prix et compteurs sont toujours plus gras et plus
 * grands que le texte qui les entoure.
 */
export const typography = {
  cardTitle: { fontSize: 16, fontWeight: "700" },
  sectionTitle: { fontSize: 20, fontWeight: "700" },
  price: { fontSize: 20, fontWeight: "800" },
  priceHero: { fontSize: 32, fontWeight: "800" },
  body: { fontSize: 15, fontWeight: "400" },
  label: { fontSize: 12, fontWeight: "500" },
} as const;

export type ColorToken = keyof typeof colors;

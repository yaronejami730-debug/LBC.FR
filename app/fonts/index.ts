import localFont from "next/font/local";

/**
 * Les polices du site, servies depuis nos propres fichiers.
 *
 * `next/font/google` télécharge la police *au moment du build*. Un build qui ne
 * joint pas `fonts.gstatic.com` — coupure réseau, pare-feu de l'exécuteur,
 * incident chez Google — échoue alors entièrement, pour une question de
 * typographie. C'est exactement ce qui s'est produit en production.
 *
 * Le fichier est donc versionné avec le code. Le build ne dépend plus d'un
 * service tiers, et le rendu ne change pas d'un déploiement à l'autre.
 *
 * Un seul fichier par famille : les trois sont des polices variables, et Google
 * servait déjà le même `.woff2` pour toutes leurs graisses.
 *
 * Sous-ensemble « latin » uniquement : il couvre les accents français, l'œ lié
 * et le signe euro. Embarquer `latin-ext` doublerait le poids pour des
 * caractères que le site n'affiche pas.
 */
export const sora = localFont({
  src: "./Sora-Variable.woff2",
  // Plage réellement utilisée par l'espace annonceur (demi-gras à extra-gras).
  weight: "600 800",
  style: "normal",
  display: "swap",
  // Repli sur la pile système : pendant le chargement, le texte reste lisible
  // plutôt qu'invisible.
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

/** Corps de texte du site. */
export const inter = localFont({
  src: "./Inter-Variable.woff2",
  weight: "400 600",
  style: "normal",
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

/** Titres et intertitres. */
export const manrope = localFont({
  src: "./Manrope-Variable.woff2",
  weight: "700 800",
  style: "normal",
  variable: "--font-manrope",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

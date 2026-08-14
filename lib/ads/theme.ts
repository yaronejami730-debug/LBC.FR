/**
 * Vocabulaire visuel de l'espace annonceur, repris de la maquette Deal&Co Ads.
 *
 * Volontairement séparé des jetons Tailwind du site public : l'annonceur
 * travaille dans un outil, pas dans la marketplace, et l'écran doit le lui
 * dire dès le premier regard. Ces valeurs sont celles du fichier de design ;
 * les approcher avec les couleurs du site aurait produit un à-peu-près.
 *
 * Fichier neutre — aucun import serveur — pour être lisible aussi bien par un
 * composant serveur que par un composant client.
 */
export const COLORS = {
  ground: "#F4F7FD",
  line: "#EDF1FA",
  ink: "#0F172A",
  muted: "#94A3B8",
  soft: "#475569",
  tint: "#F1F5FC",
  blue: "#1D4ED8",
  blueLight: "#3B82F6",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
} as const;

/** Dégradé des actions principales. */
export const PRIMARY_GRADIENT = `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.blueLight})`;

/** Ombre portée du bouton principal, telle que la maquette la pose. */
export const PRIMARY_SHADOW = "0 10px 20px -10px rgba(29,78,216,0.5)";

/** Carte : le motif répété de tout l'espace annonceur. */
export const CARD_STYLE = { border: `1px solid ${COLORS.line}`, background: "#fff" };

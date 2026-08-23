/**
 * Catalogue des réponses possibles au sondage d'acquisition.
 *
 * Séparé de `lib/attribution.ts` pour une raison mécanique : ce fichier est
 * importé par le formulaire, qui est un composant client. Le module serveur
 * touche Prisma, et Prisma entraîne `pg`, qui entraîne `fs` — le bundle client
 * échouait à la compilation. Les constantes vivent donc ici, sans dépendance,
 * et le module serveur les ré-exporte pour ceux qui ont déjà les deux.
 */

/** Journal d'événements partagé : pas de table dédiée pour six lignes par personne. */
export const ATTRIBUTION_KIND = "ATTRIBUTION";

export type AttributionSource = {
  /** Clé stable, stockée telle quelle. Ne jamais renommer : l'historique la porte. */
  key: string;
  /** Libellé montré dans l'e-mail et sur la page de réponse. */
  label: string;
  /** Précision demandée en clair, pour les réponses qui ne disent rien seules. */
  askDetail?: boolean;
};

/**
 * Les choix proposés.
 *
 * Six, pas douze : au-delà, on ne lit plus, on clique au hasard. « Autre »
 * ouvre un champ libre — c'est lui qui révélera la source à laquelle personne
 * n'avait pensé, et qui méritera sa propre ligne à la prochaine campagne.
 */
export const ATTRIBUTION_SOURCES: AttributionSource[] = [
  { key: "youtube", label: "Sur YouTube" },
  { key: "recherche", label: "Sur Google ou un autre moteur de recherche" },
  { key: "ia", label: "Via ChatGPT ou un autre assistant IA" },
  { key: "reseaux", label: "Sur Instagram, TikTok ou Facebook" },
  { key: "bouche-a-oreille", label: "Par une connaissance" },
  { key: "autre", label: "Autrement", askDetail: true },
];

const KEYS = new Set(ATTRIBUTION_SOURCES.map((s) => s.key));

export function isAttributionSource(value: unknown): value is string {
  return typeof value === "string" && KEYS.has(value);
}

export function attributionLabel(key: string): string {
  return ATTRIBUTION_SOURCES.find((s) => s.key === key)?.label ?? key;
}


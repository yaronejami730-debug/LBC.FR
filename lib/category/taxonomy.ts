/**
 * Taxonomie officielle de Deal&Co — source unique de vérité.
 *
 * `lib/categories.ts` décrit ce que voit l'utilisateur : des libellés. Ce
 * fichier en dérive ce dont un moteur a besoin : des **identifiants stables**.
 *
 * Pourquoi une dérivation plutôt qu'une seconde liste écrite à la main :
 * l'ancien système en tenait une — `categories-classifier.json`, 12 racines —
 * reliée à l'application par une table de correspondance manuelle. Trois
 * catégories sur quinze n'y figuraient pas et devenaient donc *impossibles* à
 * proposer. Une taxonomie parallèle finit toujours par diverger de celle qui
 * fait foi ; celle-ci ne le peut pas, elle est calculée.
 *
 * L'identifiant de sous-catégorie est le libellé translittéré :
 * « Ventes immobilières » → `ventes-immobilieres`. Stable tant que le libellé
 * ne change pas, lisible dans les journaux, et vérifié unique au chargement.
 */
import { CATEGORIES } from "@/lib/categories";

export type SubcategoryNode = {
  /** `vehicules/voitures` — unique dans toute la taxonomie. */
  key: string;
  categoryId: string;
  subcategoryId: string;
  /** Libellé exact attendu par le formulaire et la base. */
  label: string;
  categoryLabel: string;
};

/** Translittération stable d'un libellé en identifiant. */
export function toId(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const NODES: SubcategoryNode[] = CATEGORIES.flatMap((c) =>
  c.subcategories.map((label) => ({
    key: `${c.id}/${toId(label)}`,
    categoryId: c.id,
    subcategoryId: toId(label),
    label,
    categoryLabel: c.label,
  })),
);

export const NODE_BY_KEY = new Map(NODES.map((n) => [n.key, n]));

/**
 * Garde-fou de chargement.
 *
 * Deux libellés qui produisent le même identifiant — « Jeux & jouets » sous
 * Loisirs et sous Bébé produisent bien deux clés distinctes grâce au préfixe
 * de catégorie, mais une collision *dans* une catégorie serait silencieuse et
 * ferait disparaître une sous-catégorie du moteur. On préfère échouer au
 * démarrage.
 */
{
  const seen = new Set<string>();
  for (const n of NODES) {
    if (seen.has(n.key)) {
      throw new Error(`Taxonomie : clé dupliquée « ${n.key} ». Deux libellés produisent le même identifiant.`);
    }
    seen.add(n.key);
  }
}

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export function categoryLabel(categoryId: string): string {
  return CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;
}

/** Retrouve un nœud à partir des valeurs stockées sur une annonce. */
export function nodeFromLabels(categoryId: string, subLabel: string | null): SubcategoryNode | null {
  if (!subLabel) return null;
  return NODE_BY_KEY.get(`${categoryId}/${toId(subLabel)}`) ?? null;
}

/** Sous-catégories d'une catégorie, dans l'ordre du formulaire. */
export function nodesOf(categoryId: string): SubcategoryNode[] {
  return NODES.filter((n) => n.categoryId === categoryId);
}

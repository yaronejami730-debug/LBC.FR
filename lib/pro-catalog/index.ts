/**
 * Accès au catalogue de prestations PRO (30 catégories, 177 sous-catégories,
 * 2 200 prestations publiables).
 *
 * ⚠️ Ce module embarque l'arbre complet (2,3 Mo). Il est réservé au serveur.
 * Pour l'autocomplétion, importer `lib/pro-catalog/suggest` : l'index plat fait
 * moitié moins lourd et n'a aucune dépendance sur ce fichier.
 *
 * Le JSON est la sortie de `data/pro-catalog/build_catalog.py` — pour ajouter
 * une prestation on édite le script puis on régénère, jamais l'inverse.
 */
import rawCatalog from "@/data/pro-catalog/catalogue_prestations_pro.json";
import type {
  ProCatalog,
  ProCategory,
  ProCategoryOutline,
  ProCoherenceLevel,
  ProFieldDefinition,
  ProLeaf,
  ProSubcategory,
  ProActivityDomain,
} from "./types";

export * from "./types";

// Le JSON est figé par le générateur : on lui applique le contrat plutôt que de
// laisser TypeScript inférer 2 200 littéraux (inférence lente et inutilisable).
export const PRO_CATALOG = rawCatalog as unknown as ProCatalog;

export const PRO_CATEGORIES = PRO_CATALOG.categories;
export const PRO_DOMAINS = PRO_CATALOG.activity_domains;
export const PRO_FIELD_DEFINITIONS = PRO_CATALOG.field_definitions;
export const PRO_COHERENCE_POLICY = PRO_CATALOG.coherence_policy;
export const PRO_CATALOG_VERSION = PRO_CATALOG.$schema_version;

/**
 * Index construits une fois au premier accès. En Fluid Compute l'instance est
 * réutilisée entre requêtes : on paye ce coût une fois par instance, pas par
 * appel.
 */
type Indexes = {
  categoryById: Map<string, ProCategory>;
  subcategoryById: Map<string, ProSubcategory>;
  leafById: Map<string, ProLeaf>;
  /** Les slugs ne sont pas uniques globalement (11 collisions) : première feuille gagne. */
  leafBySlug: Map<string, ProLeaf>;
  domainById: Map<string, ProActivityDomain>;
  fieldById: Map<string, ProFieldDefinition>;
};

let indexes: Indexes | null = null;

function getIndexes(): Indexes {
  if (indexes) return indexes;
  const built: Indexes = {
    categoryById: new Map(),
    subcategoryById: new Map(),
    leafById: new Map(),
    leafBySlug: new Map(),
    domainById: new Map(),
    fieldById: new Map(),
  };
  for (const category of PRO_CATEGORIES) {
    built.categoryById.set(category.id, category);
    for (const sub of category.children) {
      built.subcategoryById.set(sub.id, sub);
      for (const leaf of sub.children) {
        built.leafById.set(leaf.id, leaf);
        if (!built.leafBySlug.has(leaf.slug)) built.leafBySlug.set(leaf.slug, leaf);
      }
    }
  }
  for (const domain of PRO_DOMAINS) built.domainById.set(domain.id, domain);
  for (const field of PRO_FIELD_DEFINITIONS) built.fieldById.set(field.id, field);
  indexes = built;
  return built;
}

export function getProCategory(id: string): ProCategory | null {
  return getIndexes().categoryById.get(id) ?? null;
}

export function getProSubcategory(id: string): ProSubcategory | null {
  return getIndexes().subcategoryById.get(id) ?? null;
}

export function getProLeaf(id: string): ProLeaf | null {
  return getIndexes().leafById.get(id) ?? null;
}

export function getProLeafBySlug(slug: string): ProLeaf | null {
  return getIndexes().leafBySlug.get(slug) ?? null;
}

export function getProDomain(id: string): ProActivityDomain | null {
  return getIndexes().domainById.get(id) ?? null;
}

export function getProField(id: string): ProFieldDefinition | null {
  return getIndexes().fieldById.get(id) ?? null;
}

/** Id de catégorie porté par n'importe quel id de l'arbre (`C08.S01.L003` → `C08`). */
export function categoryIdOf(nodeId: string): string {
  return nodeId.split(".")[0];
}

/**
 * Champs du formulaire à afficher pour une prestation, définitions résolues et
 * dans l'ordre du catalogue. Un id inconnu est ignoré plutôt que de faire
 * échouer le rendu du formulaire.
 */
export function resolveProFields(fieldIds: string[]): ProFieldDefinition[] {
  const { fieldById } = getIndexes();
  const out: ProFieldDefinition[] = [];
  for (const id of fieldIds) {
    const def = fieldById.get(id);
    if (def) out.push(def);
  }
  return out;
}

export type ProDomainSelection = {
  /** Domaine principal déclaré par le pro. */
  main: string;
  /** Domaines secondaires justifiés (2 max, cf. `coherence_policy`). */
  secondary?: string[];
};

export type ProCoherenceResult = {
  level: ProCoherenceLevel;
  /** Domaine qui autorise la publication, quand il y en a un. */
  matchedDomain: string | null;
  reason: string;
};

/**
 * Cohérence métier : est-ce qu'un pro dont l'activité déclarée est X a le droit
 * de publier dans la catégorie Y ?
 *
 * `allow` publication directe · `review` publication + modération légère ·
 * `block` refus, le pro doit ajouter une activité secondaire justifiée.
 * Un VTC qui publie de la coiffure tombe en `block` — c'est le garde-fou qui
 * empêche le catalogue de se transformer en fourre-tout.
 */
export function checkProCoherence(
  selection: ProDomainSelection,
  nodeId: string,
): ProCoherenceResult {
  const catId = categoryIdOf(nodeId);
  const levels = PRO_COHERENCE_POLICY.levels;

  const main = getProDomain(selection.main);
  if (main?.allowed_categories.includes(catId)) {
    return { level: "allow", matchedDomain: main.id, reason: levels.allow };
  }

  // Les secondaires ne donnent accès qu'à leur périmètre direct : un domaine
  // secondaire ne doit pas ouvrir en cascade ses propres catégories adjacentes.
  const secondaryIds = (selection.secondary ?? []).slice(
    0,
    PRO_COHERENCE_POLICY.max_secondary_domains,
  );
  for (const id of secondaryIds) {
    if (getProDomain(id)?.allowed_categories.includes(catId)) {
      return { level: "allow", matchedDomain: id, reason: levels.allow };
    }
  }

  if (main?.adjacent_categories.includes(catId)) {
    return { level: "review", matchedDomain: main.id, reason: levels.review };
  }

  return { level: "block", matchedDomain: null, reason: levels.block };
}

/** Catégories autorisées puis adjacentes — c'est le catalogue filtré d'une boutique pro. */
export function proCategoriesForDomain(selection: ProDomainSelection): {
  allowed: ProCategory[];
  adjacent: ProCategory[];
} {
  const allowedIds = new Set<string>();
  const main = getProDomain(selection.main);
  for (const id of main?.allowed_categories ?? []) allowedIds.add(id);
  for (const secondary of (selection.secondary ?? []).slice(
    0,
    PRO_COHERENCE_POLICY.max_secondary_domains,
  )) {
    for (const id of getProDomain(secondary)?.allowed_categories ?? []) allowedIds.add(id);
  }
  const adjacentIds = (main?.adjacent_categories ?? []).filter((id) => !allowedIds.has(id));

  return {
    allowed: PRO_CATEGORIES.filter((c) => allowedIds.has(c.id)),
    adjacent: PRO_CATEGORIES.filter((c) => adjacentIds.includes(c.id)),
  };
}

/** Vue légère de l'arbre : catégories + sous-catégories, sans les 2 200 feuilles. */
export function proCategoryOutline(): ProCategoryOutline[] {
  return PRO_CATEGORIES.map((c) => ({
    id: c.id,
    slug: c.slug,
    label: c.label,
    icon: c.icon,
    domain: c.domain,
    count: c.count,
    default_fields: c.default_fields,
    variants: c.variants,
    subcategories: c.children.map((s) => ({
      id: s.id,
      slug: s.slug,
      label: s.label,
      count: s.count,
    })),
  }));
}

/**
 * Types du catalogue de prestations PRO (data/pro-catalog/).
 *
 * Le JSON est généré par `build_catalog.py` : on ne l'édite jamais à la main,
 * donc ces types décrivent une structure figée par le générateur. Ils servent
 * de contrat entre le fichier et le reste de l'app.
 */

/** Type d'un champ de formulaire dynamique. Le front choisit le composant. */
export type ProFieldType =
  | "boolean"
  | "date"
  | "document"
  | "duration"
  | "media"
  | "multiselect"
  | "number"
  | "percent"
  | "price"
  | "range"
  | "schedule"
  | "select"
  | "text"
  | "zone";

export type ProFieldDefinition = {
  id: string;
  label: string;
  type: ProFieldType;
  /** Valeurs proposées pour `select` / `multiselect`. `null` pour les autres. */
  options: string[] | null;
};

/**
 * Domaine d'activité déclaré par le pro. `allowed_categories` = publication
 * directe, `adjacent_categories` = publication sous modération. Tout le reste
 * est bloqué tant qu'une activité secondaire justifiée n'est pas ajoutée.
 */
export type ProActivityDomain = {
  id: string;
  label: string;
  allowed_categories: string[];
  adjacent_categories: string[];
  rule: "allow";
};

/** Feuille de l'arbre = une prestation publiable. */
export type ProLeaf = {
  /** `C01.S01.L001` — positionnel, stable : ne jamais réordonner le générateur. */
  id: string;
  slug: string;
  label: string;
  level: 3;
  /** [catégorie, sous-catégorie, prestation] — prêt pour un fil d'Ariane. */
  path: [string, string, string];
  /** Libellé sans la déclinaison. Égal à `label` quand `variant` est `null`. */
  base_label: string;
  /** Déclinaison pré-générée (« à domicile », « en urgence »…), sinon `null`. */
  variant: string | null;
  /** Mots-clés d'autosuggestion (déjà découpés, non accentués côté recherche). */
  keywords: string[];
  /** Ids de `field_definitions` à afficher dans le formulaire. */
  fields: string[];
  domain: string;
  /** Justificatifs exigés. Vide quand `regulated` est `false`. */
  requires_qualification: string[];
  regulated: boolean;
  pro_only: boolean;
};

export type ProSubcategory = {
  id: string;
  slug: string;
  label: string;
  level: 2;
  count: number;
  children: ProLeaf[];
};

export type ProCategory = {
  id: string;
  slug: string;
  label: string;
  level: 1;
  icon: string;
  domain: string;
  /** Champs communs à toutes les feuilles de la catégorie. */
  default_fields: string[];
  /** Déclinaisons proposables en second temps par l'app. */
  variants: string[];
  count: number;
  children: ProSubcategory[];
};

export type ProCoherencePolicy = {
  levels: Record<ProCoherenceLevel, string>;
  max_secondary_domains: number;
  justification_required_for_secondary: string[];
  regulated_leaf_flag: string;
};

export type ProCoherenceLevel = "allow" | "review" | "block";

export type ProCatalog = {
  $schema_version: string;
  name: string;
  locale: string;
  generated_at: string;
  description: string;
  stats: {
    categories: number;
    subcategories: number;
    leaves: number;
    fields: number;
    domains: number;
  };
  coherence_policy: ProCoherencePolicy;
  field_definitions: ProFieldDefinition[];
  activity_domains: ProActivityDomain[];
  categories: ProCategory[];
};

/** Entrée de l'index plat, volontairement compacte (1,2 Mo pour 2 200 items). */
export type ProSuggestItem = {
  id: string;
  label: string;
  cat: string;
  sub: string;
  domain: string;
  slug: string;
  /** keywords */
  kw: string[];
  /** fields */
  f: string[];
};

export type ProSuggestIndex = {
  version: string;
  count: number;
  items: ProSuggestItem[];
};

/* ------------------------------------------------------------------ *
 * Contrat de /api/taxonomy/pro
 *
 * Ces types sont partagés par la route et par le client : une vue qui
 * change de forme casse la compilation des deux côtés d'un coup.
 * ------------------------------------------------------------------ */

/** Catégorie allégée : ses sous-catégories, mais pas ses feuilles. */
export type ProCategoryOutline = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  domain: string;
  count: number;
  default_fields: string[];
  variants: string[];
  subcategories: { id: string; slug: string; label: string; count: number }[];
};

export type ProCatalogMeta = {
  version: string;
  generatedAt: string;
  stats: ProCatalog["stats"];
};

export type ProOutlineResponse = ProCatalogMeta & { categories: ProCategoryOutline[] };
export type ProCategoryResponse = ProCatalogMeta & { category: ProCategory };
export type ProLeafResponse = ProCatalogMeta & { leaf: ProLeaf; fields: ProFieldDefinition[] };
export type ProFieldsResponse = ProCatalogMeta & { fields: ProFieldDefinition[] };
export type ProDomainsResponse = ProCatalogMeta & {
  domains: ProActivityDomain[];
  coherencePolicy: ProCoherencePolicy;
};
export type ProCoherenceResponse = ProCatalogMeta & {
  level: ProCoherenceLevel;
  matchedDomain: string | null;
  reason: string;
  allowedCategories: { id: string; label: string }[];
  adjacentCategories: { id: string; label: string }[];
};
export type ProSuggestResponse = {
  version: string;
  mode: "query" | "prompt";
  count: number;
  results: (ProSuggestItem & { score: number })[];
};

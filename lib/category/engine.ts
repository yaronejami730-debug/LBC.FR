/**
 * Moteur de catégorisation.
 *
 * Il ne lit **jamais** le jeu d'exemples : il interroge l'index compact
 * (`data/classifier/index.json`), deux tables de hachage construites au build.
 * Parcourir 72 000 titres à chaque frappe serait absurde ; interroger une table
 * est instantané.
 *
 * Le scoring répond à la faute constatée à l'audit — « Lit bébé évolutif »
 * classé en Maison / Ameublement. Trois mécanismes, dans cet ordre :
 *
 *  1. **Les termes ne se valent pas.** Un nom-tête pèse dix, un qualificatif
 *     quatre, un mot du commerce zéro. « Urgent » n'a jamais désigné un rayon.
 *  2. **Les paires priment sur les mots isolés.** « lit + bébé » vaut plus que
 *     « lit » et « bébé » comptés séparément : c'est l'association qui porte le
 *     sens, pas l'addition.
 *  3. **Certains qualificatifs déplacent la catégorie.** « bébé » ne décrit pas
 *     un lit, il change de rayon. Les dominants sont classés par rang, sans
 *     quoi « siège auto bébé » hésiterait entre l'enfant et la voiture.
 *
 * Et une règle de retenue : sans marge suffisante entre les deux premiers, le
 * moteur répond « ambigu » plutôt que de trancher au hasard. Répondre juste
 * importe plus que répondre toujours.
 */
import index from "@/data/classifier/index.json";
import { NODE_BY_KEY, categoryLabel, type SubcategoryNode } from "./taxonomy";

type IndexShape = {
  terms: Record<string, Record<string, number>>;
  pairs: Record<string, Record<string, number>>;
  generics: string[];
  dominants: { term: string; categoryId: string; rank: number }[];
  typos: Record<string, string>;
  stats: { entries: number; nodes: number; terms: number; pairs: number };
};

const IDX = index as unknown as IndexShape;
const GENERICS = new Set(IDX.generics);
const TYPOS = IDX.typos;
const DOMINANTS = new Map(IDX.dominants.map((d) => [d.term, d]));

/** Seuils, réglables sans redéploiement de logique. */
export const THRESHOLDS = {
  /** Au-delà : la catégorie est appliquée d'office. */
  auto: 0.85,
  /** Au-delà : elle est proposée, l'utilisateur peut la changer d'un geste. */
  suggest: 0.6,
  /** Écart minimal avec le second, sinon ambigu. */
  margin: 0.18,
};

export type Signal = {
  term: string;
  kind: "nom-tête" | "marque/modèle" | "qualificatif" | "association" | "générique" | "dominant";
  weight: number;
};

export type ClassifyResult = {
  status: "auto" | "suggested" | "ambiguous" | "unknown";
  categoryId: string | null;
  subcategoryId: string | null;
  /** Libellé exact attendu par le formulaire. */
  subcategory: string | null;
  categoryLabel: string | null;
  confidence: number;
  signals: Signal[];
  alternatives: { categoryId: string; subcategoryId: string; label: string; confidence: number }[];
};

const EMPTY: ClassifyResult = {
  status: "unknown",
  categoryId: null,
  subcategoryId: null,
  subcategory: null,
  categoryLabel: null,
  confidence: 0,
  signals: [],
  alternatives: [],
};

/**
 * Normalisation : minuscules, accents pliés, ponctuation neutralisée.
 *
 * Le titre original n'est jamais modifié — seule la représentation de travail
 * l'est. « iPhone 15 Pro MAX !!! » et « iphone 15 pro max » doivent produire la
 * même décision.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokens utiles : les mots du commerce sont écartés dès la tokenisation. */
function tokenize(normalized: string): string[] {
  return normalized
    .split(" ")
    .filter((t) => t.length >= 2)
    .map((t) => TYPOS[t] ?? t);
}

/** Groupes de un à trois mots — « table de massage » n'est pas « table ». */
function grams(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    out.push(tokens[i]);
    if (i + 1 < tokens.length) out.push(`${tokens[i]} ${tokens[i + 1]}`);
    if (i + 2 < tokens.length) out.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }
  return out;
}

export function classifyTitle(title: string, description = ""): ClassifyResult {
  const raw = `${title} ${description}`.trim();
  if (normalize(title).length < 3) return EMPTY;

  const tokens = tokenize(normalize(raw));
  if (tokens.length === 0) return EMPTY;

  const scores = new Map<string, number>();
  /** Meilleur terme unique par nœud : distingue une preuve d'une accumulation. */
  const bestTerm = new Map<string, number>();
  const signals: Signal[] = [];
  const seenTerms = new Set<string>();
  /** Une preuve forte est un nom-tête, un modèle, ou une association. */
  let strongEvidence = false;

  const bump = (key: string, weight: number) => {
    scores.set(key, (scores.get(key) ?? 0) + weight);
  };

  // 1. Termes simples et composés.
  for (const gram of grams(tokens)) {
    if (seenTerms.has(gram)) continue;
    seenTerms.add(gram);

    if (GENERICS.has(gram)) {
      signals.push({ term: gram, kind: "générique", weight: 0 });
      continue;
    }

    const hits = IDX.terms[gram];
    if (!hits) continue;

    // Un terme partagé par vingt nœuds ne prouve pas grand-chose : son poids
    // est divisé par sa dispersion, comme une pondération inverse de fréquence.
    const spread = Object.keys(hits).length;
    const dilution = 1 / Math.sqrt(spread);
    let best = 0;
    for (const [key, weight] of Object.entries(hits)) {
      const value = weight * dilution * (gram.includes(" ") ? 1.6 : 1);
      bump(key, value);
      bestTerm.set(key, Math.max(bestTerm.get(key) ?? 0, weight));
      best = Math.max(best, value);
    }
    if (best >= 6) strongEvidence = true;
    signals.push({
      term: gram,
      kind: best >= 8 ? "nom-tête" : best >= 5 ? "marque/modèle" : "qualificatif",
      weight: Math.round(best * 10) / 10,
    });
  }

  // 2. Associations : c'est ce qui distingue « lit bébé » de « lit 2 places ».
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < Math.min(tokens.length, i + 6); j++) {
      const [a, b] = [tokens[i], tokens[j]].sort();
      const hits = IDX.pairs[`${a}|${b}`];
      if (!hits) continue;
      for (const [key, weight] of Object.entries(hits)) bump(key, weight);
      strongEvidence = true;
      signals.push({ term: `${a} + ${b}`, kind: "association", weight: Math.max(...Object.values(hits)) });
    }
  }

  if (scores.size === 0) return { ...EMPTY, signals };

  // 3. Modificateurs déplaçants. Le rang le plus élevé emporte la décision :
  //    « siège auto bébé » est un article de puériculture, pas un équipement
  //    automobile.
  const present = tokens
    .map((t) => DOMINANTS.get(t))
    .filter(Boolean)
    .sort((a, b) => b!.rank - a!.rank);
  const dominant = present[0];
  if (dominant) {
    signals.push({ term: dominant.term, kind: "dominant", weight: dominant.rank });
    for (const [key, value] of scores) {
      const node = NODE_BY_KEY.get(key);
      if (!node) continue;
      scores.set(key, node.categoryId === dominant.categoryId ? value * 2.2 : value * 0.45);
    }
  }

  /**
   * Posséder le nom de la chose vendue vaut mieux que collectionner ses
   * qualificatifs. « Chaussures Nike homme 42 » sortait en *Vêtements* : la
   * marque, la taille et le genre y pesaient autant que « chaussures » ailleurs.
   * Un nœud qui détient le nom-tête reçoit donc une prime.
   */
  for (const [key, score] of scores) {
    if ((bestTerm.get(key) ?? 0) >= 9) scores.set(key, score * 1.35);
  }

  const ranked = [...scores.entries()]
    .map(([key, score]) => ({ key, score, node: NODE_BY_KEY.get(key) }))
    .filter((r) => r.node)
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const total = ranked.reduce((s, r) => s + r.score, 0);

  /**
   * La confiance mesure une décision, pas une part de marché.
   *
   * Rapportée à la somme de tous les nœuds, elle s'effondrait dès qu'un titre
   * touchait beaucoup de rubriques : « Chaussures Nike homme 42 » réveille
   * mode, sport et vêtements, et sortait sous le seuil alors que la réponse
   * était évidente. Ce qui compte est l'écart avec le premier concurrent
   * *d'une autre catégorie* — les sous-catégories d'une même famille ne se
   * contredisent pas, elles se précisent.
   */
  const runnerUp = ranked.find((r) => r.node!.categoryId !== top.node!.categoryId);
  const confidence = runnerUp ? top.score / (top.score + runnerUp.score) : 0.95;
  const margin = runnerUp ? (top.score - runnerUp.score) / top.score : 1;

  const alternatives = ranked.slice(1, 4).map((r) => ({
    categoryId: r.node!.categoryId,
    subcategoryId: r.node!.subcategoryId,
    label: `${categoryLabel(r.node!.categoryId)} / ${r.node!.label}`,
    confidence: total > 0 ? Math.round((r.score / total) * 1000) / 1000 : 0,
  }));

  const node = top.node as SubcategoryNode;
  /**
   * Une marque isolée ne désigne pas un rayon.
   *
   * « Apple » vend des téléphones, des ordinateurs, des montres et des
   * écouteurs : répondre « Informatique » avec 95 % de confiance serait un
   * tirage au sort présenté comme une certitude. Sans nom-tête ni modèle ni
   * association, et avec plusieurs sous-catégories en lice, on demande.
   */
  const weakSolo = !strongEvidence && ranked.length > 1;

  const status: ClassifyResult["status"] =
    weakSolo || margin < THRESHOLDS.margin
      ? "ambiguous"
      : confidence >= THRESHOLDS.auto
        ? "auto"
        : confidence >= THRESHOLDS.suggest
          ? "suggested"
          : "ambiguous";

  if (status === "ambiguous") {
    return {
      ...EMPTY,
      status: "ambiguous",
      confidence: Math.round(confidence * 1000) / 1000,
      signals,
      alternatives: [
        {
          categoryId: node.categoryId,
          subcategoryId: node.subcategoryId,
          label: `${categoryLabel(node.categoryId)} / ${node.label}`,
          confidence: Math.round(confidence * 1000) / 1000,
        },
        ...alternatives,
      ].slice(0, 4),
    };
  }

  return {
    status,
    categoryId: node.categoryId,
    subcategoryId: node.subcategoryId,
    subcategory: node.label,
    categoryLabel: categoryLabel(node.categoryId),
    confidence: Math.round(confidence * 1000) / 1000,
    signals: signals.sort((a, b) => b.weight - a.weight).slice(0, 12),
    alternatives,
  };
}

/** Statistiques de l'index, pour l'écran d'administration. */
export function indexStats() {
  return IDX.stats;
}

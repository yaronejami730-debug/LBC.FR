/**
 * Classifieur de types d'annonce — Phase 2 du moteur d'annonces.
 *
 * Implémente `docs/02-classification.md` : le score d'un nœud est une
 * combinaison pondérée de preuves, et **aucun nœud n'est candidat sans preuve**.
 * Le repli n'est jamais une catégorie, c'est une question.
 *
 * Ce que ça corrige, mesuré à l'audit : 24 des 154 villes de `lib/cities.ts`
 * décidaient seules d'une catégorie, « Lyon » et « Fort-de-France » sortant en
 * Véhicules. Aucune règle « si Cannes alors immobilier » n'est écrite ici —
 * c'est l'architecture de scoring qui change : les toponymes sont neutralisés
 * avant scoring, et un nœud sans nom-tête détecté n'entre pas dans la course.
 *
 * Écart assumé avec la spécification : le terme sémantique (`0.25 · cos`)
 * n'est pas implémenté, faute d'embeddings de nœuds. Son absence rend le
 * moteur **plus strict**, jamais plus permissif : la seule voie vers
 * l'éligibilité reste le nom-tête. Un nœud qui aurait dû passer par la
 * similarité produit une question, pas une erreur.
 */

import { foldAccents } from "@/lib/normalize-fr";
import { LISTING_NODES, canonicalHeadNouns, type ListingNode, type TransactionKind } from "./nodes";
import { scanEntities, tourismPrior, type CityHit } from "./gazetteer";
import lexicon from "@/data/listing-engine/classifier.lexicon.json";

// ─────────────────────────────────────────────────────────────
// Lexique
// ─────────────────────────────────────────────────────────────

type Lexicon = {
  weights: Record<string, number>;
  guardrails: {
    semantic_solo_threshold: number;
    min_confidence_to_autoselect: number;
    min_margin_top1_top2: number;
    max_suggestions: number;
  };
  text_normalization: { expand_abbreviations: Record<string, string> };
  numeric_patterns: { regex: string; field: string; boosts?: string[]; penalizes?: string[]; weak?: boolean }[];
  transaction_cues: Record<string, string[]>;
  negative_pairs: { if_present: string[]; penalize_categories: string[] }[];
  ambiguity_rules: { id: string; when: string; action: string; question: string; options: { label: string; target: string }[]; order_by?: string }[];
};

const LEX = lexicon as unknown as Lexicon;
const W = LEX.weights;
const G = LEX.guardrails;

// ─────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────

function norm(text: string): string {
  return ` ${foldAccents(text)
    .replace(/[^a-z0-9€/²]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/** Expansion des abréviations — après la reconnaissance d'entités, jamais avant. */
function expand(text: string): string {
  let out = text;
  for (const [abbr, full] of Object.entries(LEX.text_normalization.expand_abbreviations)) {
    const needle = ` ${norm(abbr).trim()} `;
    if (out.includes(needle)) out = out.split(needle).join(` ${norm(full).trim()} `);
  }
  return out;
}

function contains(haystack: string, term: string): boolean {
  const t = norm(term).trim();
  if (!t) return false;
  return haystack.includes(` ${t} `);
}

// ─────────────────────────────────────────────────────────────
// Types de sortie
// ─────────────────────────────────────────────────────────────

export type Evidence = {
  headNoun: string | null;
  modifiers: string[];
  transactionCue: TransactionKind | null;
  numeric: string[];
  brands: string[];
  models: string[];
  city: { name: string; tourismIndex: number; role: "market_prior_only" } | null;
  negativeHits: string[];
};

export type Candidate = {
  key: string;
  node: ListingNode;
  score: number;
  confidence: number;
  evidence: Evidence;
};

export type ClassifyDecision =
  | { action: "autoselect"; chosen: Candidate; candidates: Candidate[] }
  | { action: "confirm"; candidates: Candidate[] }
  | { action: "ask"; question: string; questionId: string | null; options: { label: string; target: string }[]; candidates: Candidate[] };

export type ClassifyResult = ClassifyDecision & {
  /** Toutes les preuves globales, pour la traçabilité exigée par le pack. */
  cities: CityHit[];
  /** Texte lexical réellement scoré, entités retirées. */
  lexicalText: string;
};

// ─────────────────────────────────────────────────────────────
// Détection des indices transversaux
// ─────────────────────────────────────────────────────────────

/** Indice de transaction le plus long trouvé — « à louer » avant « louer ». */
function detectTransaction(text: string): TransactionKind | null {
  let best: { kind: string; len: number } | null = null;
  for (const [kind, cues] of Object.entries(LEX.transaction_cues)) {
    for (const cue of cues) {
      const t = norm(cue).trim();
      if (t && text.includes(` ${t} `) && (!best || t.length > best.len)) {
        best = { kind, len: t.length };
      }
    }
  }
  return (best?.kind as TransactionKind) ?? null;
}

type NumericHit = { field: string; boosts: string[]; penalizes: string[]; weak: boolean };

function detectNumeric(text: string): NumericHit[] {
  const hits: NumericHit[] = [];
  for (const p of LEX.numeric_patterns) {
    let re: RegExp;
    try {
      re = new RegExp(p.regex, "i");
    } catch {
      continue; // motif illisible côté JS — ignoré plutôt que de casser le moteur
    }
    if (re.test(text)) {
      hits.push({ field: p.field, boosts: p.boosts ?? [], penalizes: p.penalizes ?? [], weak: p.weak === true });
    }
  }
  return hits;
}

function detectNegatives(text: string): { terms: string[]; roots: Set<string> } {
  const terms: string[] = [];
  const roots = new Set<string>();
  for (const pair of LEX.negative_pairs) {
    const found = pair.if_present.filter((t) => contains(text, t));
    if (found.length > 0) {
      terms.push(...found);
      for (const c of pair.penalize_categories) roots.add(c);
    }
  }
  return { terms, roots };
}

/**
 * Un « boost » du lexique cible un préfixe de clé qui n'est pas toujours celui
 * de la taxonomie : `vehicules.loa-lld` doit atteindre
 * `vehicules.voitures.loa-lld`. On teste donc l'inclusion des segments dans
 * l'ordre, pas l'égalité de préfixe.
 */
function keyMatchesTarget(key: string, target: string): boolean {
  const keySegs = key.split(".");
  const targetSegs = target.split(".");
  let i = 0;
  for (const seg of keySegs) {
    if (seg === targetSegs[i]) i++;
  }
  return i === targetSegs.length;
}

// ─────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────

/**
 * Un nom-tête peut appartenir à plusieurs nœuds. « fourgon » figure dans le
 * lexique des voitures *et* désigne la famille des utilitaires. Le terme qui
 * **nomme la famille** l'emporte sur celui qui y est simplement toléré — sans
 * cela, « Fourgon Renault Master » sortirait en voiture.
 */
const CANONICAL_BONUS = 1.0;
const BORROWED_BONUS = 0.85;

function headNounMatch(node: ListingNode, text: string): { term: string; specificity: number } | null {
  const canonical = new Set(canonicalHeadNouns(node).map((t) => norm(t).trim()));
  let best: { term: string; specificity: number } | null = null;
  for (const term of node.headNouns) {
    if (!contains(text, term)) continue;
    const normalized = norm(term).trim();
    // Le critère n'est pas « ce nœud a-t-il une configuration » — c'était une
    // erreur, elle pénalisait justement les types les mieux décrits. Le critère
    // est : ce terme nomme-t-il la famille de ce nœud, ou y est-il emprunté ?
    const specificity = canonical.has(normalized) ? CANONICAL_BONUS : BORROWED_BONUS;
    const candidate = { term: normalized, specificity };
    if (!best || candidate.specificity > best.specificity || candidate.term.length > best.term.length) {
      best = candidate;
    }
  }
  return best;
}

function scoreNode(
  node: ListingNode,
  ctx: {
    text: string;
    transaction: TransactionKind | null;
    numeric: NumericHit[];
    negativeRoots: Set<string>;
    negativeTerms: string[];
    models: { term: string; sub: string }[];
    brands: string[];
    cities: CityHit[];
  },
): Candidate | null {
  const head = headNounMatch(node, ctx.text);

  // Une marque ou un modèle reconnu vaut nom-tête pour son nœud véhicule : ce
  // sont des entités typées, pas des mots ordinaires. « Twingo » désigne une
  // voiture aussi sûrement que le mot « voiture ».
  const modelHit = ctx.models.find((m) => node.rootSlug === "vehicules" && node.subSlug === m.sub);
  const brandSupportsVehicle = ctx.brands.length > 0 && node.rootSlug === "vehicules";

  const evidenceHead = head?.term ?? modelHit?.term ?? null;
  const isEligible = Boolean(head || modelHit);
  if (!isEligible) return null;

  const headSpecificity = head?.specificity ?? CANONICAL_BONUS;
  let score = W.head_noun * headSpecificity;

  // Modificateurs — part de ceux du nœud réellement présents.
  const modifiers = node.modifiers.filter((m) => contains(ctx.text, m));
  if (node.modifiers.length > 0) {
    score += W.modifiers * (modifiers.length / node.modifiers.length);
  }

  // Transaction. Un indice explicite est une information forte : un nœud qui ne
  // sait pas la servir n'est pas « moins probable », il est faux.
  let transactionCue: TransactionKind | null = null;
  if (ctx.transaction) {
    const supports = node.transactions.includes(ctx.transaction);
    if (supports) {
      transactionCue = ctx.transaction;
      score += W.transaction_cue;
    } else {
      score += W.negative_penalty * 0.5;
    }
  } else if (node.transactions.includes("vente")) {
    // Sans indice, la vente est le régime par défaut du site. Prior faible,
    // jamais décisif — il ne rend aucun nœud éligible.
    score += W.prior;
  }

  // Indices numériques.
  const numericFields: string[] = [];
  for (const hit of ctx.numeric) {
    const weight = W.numeric_pattern * (hit.weak ? 0.4 : 1);
    if (hit.boosts.some((t) => keyMatchesTarget(node.key, t))) {
      score += weight;
      numericFields.push(hit.field);
    }
    if (hit.penalizes.some((t) => keyMatchesTarget(node.key, t))) {
      score += W.negative_penalty * 0.35;
      numericFields.push(`−${hit.field}`);
    }
  }

  // Négatifs — du lexique global et du nœud lui-même.
  const nodeNegatives = node.negatives.filter((n) => contains(ctx.text, n));
  let negativeHits = [...nodeNegatives];
  if (ctx.negativeRoots.has(node.rootSlug)) {
    negativeHits = [...negativeHits, ...ctx.negativeTerms];
    score += W.negative_penalty;
  }
  if (nodeNegatives.length > 0) score += W.negative_penalty * 0.5;

  if (brandSupportsVehicle && !modelHit) score += W.prior;

  // Départage minimal entre deux nœuds également prouvés : un type doté d'une
  // configuration complète est un type réellement supporté par le produit ; un
  // nœud dérivé du seul slug est un emplacement en attente de sa config.
  if (node.hasConfig) score += W.prior;

  // Prior de marché : la ville n'oriente que *dans* une racine déjà éligible.
  const tourism = tourismPrior(ctx.cities);
  if (tourism > 0 && node.subSlug === "location-vacances") {
    score += W.prior * tourism;
  }

  const city = ctx.cities[0]
    ? { name: ctx.cities[0].name, tourismIndex: ctx.cities[0].tourismIndex, role: "market_prior_only" as const }
    : null;

  return {
    key: node.key,
    node,
    score,
    confidence: 0,
    evidence: {
      headNoun: evidenceHead,
      modifiers,
      transactionCue,
      numeric: numericFields,
      brands: ctx.brands,
      models: ctx.models.map((m) => m.term),
      city,
      negativeHits,
    },
  };
}

/** Softmax sur les scores retenus — donne une confiance comparable entre requêtes. */
function softmax(candidates: Candidate[]): void {
  if (candidates.length === 0) return;
  const max = Math.max(...candidates.map((c) => c.score));
  const exps = candidates.map((c) => Math.exp((c.score - max) * 6));
  const sum = exps.reduce((a, b) => a + b, 0);
  candidates.forEach((c, i) => {
    c.confidence = Math.round((exps[i] / sum) * 100) / 100;
  });
}

// ─────────────────────────────────────────────────────────────
// Décision
// ─────────────────────────────────────────────────────────────

function ambiguityRuleFor(rootSlug: string) {
  const byRoot: Record<string, string> = {
    immobilier: "immo_sans_verbe",
    vehicules: "vehicule_sans_verbe",
    materiel: "materiel_vente_ou_location",
  };
  const id = byRoot[rootSlug];
  return id ? (LEX.ambiguity_rules.find((r) => r.id === id) ?? null) : null;
}

/**
 * Classe un texte libre.
 *
 * @example
 *   classifyListing("Appartement Cannes")
 *     → action "ask", question « Que souhaitez-vous faire avec ce bien ? »,
 *       candidats immobiliers uniquement — aucun nœud véhicule n'est éligible.
 */
export function classifyListing(input: string): ClassifyResult {
  const scan = scanEntities(input);
  const text = expand(scan.lexicalText);

  const transaction = detectTransaction(text);
  const numeric = detectNumeric(text);
  const { terms: negativeTerms, roots: negativeRoots } = detectNegatives(text);

  const ctx = {
    text,
    transaction,
    numeric,
    negativeRoots,
    negativeTerms,
    models: scan.models,
    brands: scan.brands,
    cities: scan.cities,
  };

  const scored = LISTING_NODES.map((n) => scoreNode(n, ctx)).filter((c): c is Candidate => c !== null);

  // Garde-fou 1 — aucune preuve, aucun candidat. Le prior seul n'existe pas.
  if (scored.length === 0) {
    return {
      action: "ask",
      questionId: null,
      question: "Dans quelle catégorie souhaitez-vous publier ?",
      options: [],
      candidates: [],
      cities: scan.cities,
      lexicalText: text,
    };
  }

  scored.sort((a, b) => b.score - a.score);

  // Un indice de transaction explicite ne fait pas qu'affaiblir les nœuds qui
  // ne le servent pas : il les disqualifie. « charges comprises » dit un bail,
  // et proposer une location de vacances à côté n'est pas une alternative
  // prudente, c'est une suggestion fausse.
  const compatible = transaction
    ? scored.filter((c) => c.node.transactions.includes(transaction))
    : scored;
  const pool = compatible.length > 0 ? compatible : scored;

  const shortlist = pool.slice(0, Math.max(G.max_suggestions, 3));
  softmax(shortlist);

  const [top, second] = shortlist;

  /**
   * Garde-fou 5 — catégorie sûre, transaction ambiguë : on demande la
   * transaction, pas la catégorie.
   *
   * L'ambiguïté ne se lit pas sur un nœud isolé : la taxonomie place la
   * transaction tantôt au niveau 2 (`immobilier.vente.appartement`), tantôt au
   * niveau 3 (`vehicules.voitures.vente`). Elle se lit sur la *fratrie* — les
   * candidats qui partagent le même nom-tête et diffèrent par la transaction.
   * C'est exactement le cas « Appartement Cannes ».
   */
  const siblingTransactions = new Set(
    shortlist
      .filter((c) => c.node.rootSlug === top.node.rootSlug && c.evidence.headNoun === top.evidence.headNoun)
      .flatMap((c) => c.node.transactions),
  );
  if (!top.evidence.transactionCue && siblingTransactions.size > 1) {
    const rule = ambiguityRuleFor(top.node.rootSlug);
    if (rule) {
      return {
        action: "ask",
        questionId: rule.id,
        question: rule.question,
        options: orderOptions(rule.options, scan.cities),
        candidates: shortlist,
        cities: scan.cities,
        lexicalText: text,
      };
    }
  }

  // Garde-fou 3 — confiance absolue insuffisante.
  if (top.confidence < G.min_confidence_to_autoselect) {
    return {
      action: "ask",
      questionId: null,
      question: "Précisez ce que vous publiez",
      options: [],
      candidates: shortlist,
      cities: scan.cities,
      lexicalText: text,
    };
  }

  // Garde-fou 4 — deux candidats trop proches.
  if (second && top.confidence - second.confidence < G.min_margin_top1_top2) {
    return { action: "confirm", candidates: shortlist, cities: scan.cities, lexicalText: text };
  }

  return { action: "autoselect", chosen: top, candidates: shortlist, cities: scan.cities, lexicalText: text };
}

/**
 * Ordonne les options d'une question par indice touristique de la ville
 * détectée. Sur Cannes (0,95), « louer pour les vacances » passe en tête ; à
 * Lille (0,30), la vente. Aucune règle nominative : c'est l'indice qui trie.
 */
function orderOptions(
  options: { label: string; target: string }[],
  cities: CityHit[],
): { label: string; target: string }[] {
  const tourism = tourismPrior(cities);
  if (tourism < 0.6) return options;
  return [...options].sort((a, b) => {
    const rank = (t: string) => (t.includes("location-vacances") ? 0 : 1);
    return rank(a.target) - rank(b.target);
  });
}

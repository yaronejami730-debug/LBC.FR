/**
 * AdClassifier — Moteur de classification d'annonces par mots-clés pondérés
 * Porté en TypeScript depuis classifier.js v2.0
 */

// ─────────────────────────────────────────────────────────────
// 1. TYPES
// ─────────────────────────────────────────────────────────────

interface SubcategoryData {
  name: string;
  priority: number;
  keywords?: string[];
  brands?: string[];
  models?: string[];
  synonyms?: string[];
  common_mistakes?: string[];
}

interface CategoryData {
  name: string;
  priority: number;
  subcategories?: SubcategoryData[];
}

export interface CategoriesJSON {
  version: string;
  categories: CategoryData[];
}

interface IndexEntry {
  category: string;
  subcategory: string;
  weight: number;
  source: string;
}

interface PhraseEntry extends IndexEntry {
  phrase: string;
  words: string[];
}

interface FuzzyEntry extends IndexEntry {
  term: string;
}

interface ScoreEntry {
  category: string;
  subcategory: string;
  rawScore: number;
  finalScore: number;
  matchCount: number;
  matches: { term: string; source: string; weight: number }[];
  categoryPriority: number;
  subcategoryPriority: number;
}

export interface ClassificationResult {
  success: boolean;
  category: string | null;
  subcategory: string | null;
  confidence: number;
  score: number;
  matches: { term: string; source: string; weight: number }[];
  alternatives: { category: string; subcategory: string; score: number; confidence: number }[];
}

// ─────────────────────────────────────────────────────────────
// 2. NORMALISATION
// ─────────────────────────────────────────────────────────────

const ACCENT_MAP: Record<string, string> = {
  à: "a", â: "a", ä: "a", á: "a", ã: "a",
  è: "e", ê: "e", ë: "e", é: "e",
  ì: "i", î: "i", ï: "i", í: "i",
  ò: "o", ô: "o", ö: "o", ó: "o", õ: "o",
  ù: "u", û: "u", ü: "u", ú: "u",
  ý: "y", ÿ: "y",
  ñ: "n", ç: "c", œ: "oe", æ: "ae",
  š: "s", ž: "z", ð: "d",
};

function normalizeText(text: string): string {
  if (!text || typeof text !== "string") return "";
  let result = text.toLowerCase().trim();
  result = result.replace(/[àâäáãèêëéìîïíòôöóõùûüúýÿñçœæšžð]/g, (ch) => ACCENT_MAP[ch] ?? ch);
  result = result.replace(/[''""«»„…·•●]/g, " ");
  result = result.replace(/[,;:!?\(\)\[\]\{\}\/\\@#\$%\^&\*\+=<>|~`"]/g, " ");
  result = result.replace(/[']/g, " ");
  result = result.replace(/\s+/g, " ").trim();
  return result;
}

// ─────────────────────────────────────────────────────────────
// 3. LEVENSHTEIN
// ─────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const bLen = b.length;
  const row = new Uint16Array(bLen + 1);
  for (let j = 0; j <= bLen; j++) row[j] = j;

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const val = Math.min(row[j] + 1, prev + 1, row[j - 1] + cost);
      row[j - 1] = prev;
      prev = val;
    }
    row[bLen] = prev;
  }
  return row[bLen];
}

// ─────────────────────────────────────────────────────────────
// 4. INDEX INVERSÉ
// ─────────────────────────────────────────────────────────────

class InvertedIndex {
  exactIndex = new Map<string, IndexEntry[]>();
  phraseIndex: PhraseEntry[] = [];
  fuzzyBuckets = new Map<string, FuzzyEntry[]>();

  add(term: string, category: string, subcategory: string, weight: number, source: string) {
    const normalized = normalizeText(term);
    if (!normalized) return;

    const entry: IndexEntry = { category, subcategory, weight, source };
    const words = normalized.split(/\s+/);

    if (words.length > 1) {
      this.phraseIndex.push({ phrase: normalized, words, ...entry });
    }

    this.exactIndex.set(normalized, [...(this.exactIndex.get(normalized) ?? []), entry]);

    if (words.length === 1 && normalized.length >= 4) {
      for (let lenOffset = -1; lenOffset <= 1; lenOffset++) {
        const bucketKey = `${normalized.length + lenOffset}:${normalized[0]}`;
        if (!this.fuzzyBuckets.has(bucketKey)) this.fuzzyBuckets.set(bucketKey, []);
        this.fuzzyBuckets.get(bucketKey)!.push({ term: normalized, ...entry });
      }
    }
  }

  lookupExact(term: string): IndexEntry[] {
    return this.exactIndex.get(term) ?? [];
  }

  lookupPhrases(text: string) {
    const results: { matched: string; category: string; subcategory: string; weight: number; source: string }[] = [];
    for (const entry of this.phraseIndex) {
      if (text.includes(entry.phrase)) {
        results.push({ matched: entry.phrase, category: entry.category, subcategory: entry.subcategory, weight: entry.weight, source: entry.source });
      }
    }
    return results;
  }

  lookupFuzzy(word: string, maxDistance = 1) {
    if (word.length < 4) return [];
    const bucketKey = `${word.length}:${word[0]}`;
    const bucket = this.fuzzyBuckets.get(bucketKey) ?? [];

    const results: { matched: string; distance: number; category: string; subcategory: string; weight: number; source: string }[] = [];
    const seen = new Set<string>();

    for (const entry of bucket) {
      if (seen.has(entry.term) || entry.term === word) continue;
      const dist = levenshtein(word, entry.term);
      if (dist > 0 && dist <= maxDistance) {
        seen.add(entry.term);
        results.push({ matched: entry.term, distance: dist, category: entry.category, subcategory: entry.subcategory, weight: entry.weight * 0.6, source: "fuzzy" });
      }
    }
    return results;
  }
}

// ─────────────────────────────────────────────────────────────
// 5. POIDS
// ─────────────────────────────────────────────────────────────

const WEIGHTS = {
  source: { model: 10, brand: 8, keyword: 6, synonym: 4, mistake: 5, fuzzy: 3 },
  position: { title: 2.5, description: 1.0 },
  densityBonus: 0.15,
  densityCap: 5,
  phraseBonus: 1.8,
  minScore: 3.0,
  highConfidence: 25.0,
};

// ─────────────────────────────────────────────────────────────
// 6. CLASSIFICATEUR
// ─────────────────────────────────────────────────────────────

export class AdClassifier {
  private index: InvertedIndex;
  private categories: CategoryData[];

  constructor(categoriesData: CategoriesJSON) {
    this.index = new InvertedIndex();
    this.categories = categoriesData.categories ?? [];
    this._buildIndex();
  }

  private _buildIndex() {
    for (const cat of this.categories) {
      for (const sub of cat.subcategories ?? []) {
        const catName = cat.name;
        const subName = sub.name;
        for (const kw of sub.keywords ?? []) this.index.add(kw, catName, subName, WEIGHTS.source.keyword, "keyword");
        for (const b of sub.brands ?? []) this.index.add(b, catName, subName, WEIGHTS.source.brand, "brand");
        for (const m of sub.models ?? []) this.index.add(m, catName, subName, WEIGHTS.source.model, "model");
        for (const s of sub.synonyms ?? []) this.index.add(s, catName, subName, WEIGHTS.source.synonym, "synonym");
        for (const e of sub.common_mistakes ?? []) this.index.add(e, catName, subName, WEIGHTS.source.mistake, "mistake");
      }
    }
  }

  classify(title: string, description = "", options: { topN?: number; enableFuzzy?: boolean; fuzzyMaxDistance?: number; minScore?: number } = {}): ClassificationResult {
    const { topN = 3, enableFuzzy = true, fuzzyMaxDistance = 1, minScore = WEIGHTS.minScore } = options;

    const normalizedTitle = normalizeText(title);
    const normalizedDesc = normalizeText(description);

    const scores = new Map<string, ScoreEntry>();

    this._scorePhrases(normalizedTitle, WEIGHTS.position.title, scores);
    if (normalizedDesc) this._scorePhrases(normalizedDesc, WEIGHTS.position.description, scores);

    this._scoreWords(normalizedTitle, WEIGHTS.position.title, scores, enableFuzzy, fuzzyMaxDistance);
    if (normalizedDesc) this._scoreWords(normalizedDesc, WEIGHTS.position.description, scores, enableFuzzy, fuzzyMaxDistance);

    for (const entry of scores.values()) {
      const densityMultiplier = 1 + Math.min(entry.matchCount - 1, WEIGHTS.densityCap) * WEIGHTS.densityBonus;
      entry.finalScore = entry.rawScore * densityMultiplier;
    }

    const ranked = this._resolveConflicts([...scores.values()]);
    const filtered = ranked.filter((r) => r.finalScore >= minScore).slice(0, topN);
    const topResult = filtered[0] ?? null;

    return {
      success: !!topResult,
      category: topResult?.category ?? null,
      subcategory: topResult?.subcategory ?? null,
      confidence: topResult ? this._computeConfidence(topResult, filtered) : 0,
      score: topResult?.finalScore ?? 0,
      matches: topResult?.matches ?? [],
      alternatives: filtered.slice(1).map((r) => ({
        category: r.category,
        subcategory: r.subcategory,
        score: r.finalScore,
        confidence: this._computeConfidence(r, filtered),
      })),
    };
  }

  private _scorePhrases(text: string, positionWeight: number, scores: Map<string, ScoreEntry>) {
    for (const match of this.index.lookupPhrases(text)) {
      const key = `${match.category}|${match.subcategory}`;
      const score = match.weight * positionWeight * WEIGHTS.phraseBonus;
      this._ensureEntry(scores, key, match.category, match.subcategory);
      const entry = scores.get(key)!;
      entry.rawScore += score;
      entry.matchCount++;
      entry.matches.push({ term: match.matched, source: match.source, weight: Math.round(score * 100) / 100 });
    }
  }

  private _scoreWords(text: string, positionWeight: number, scores: Map<string, ScoreEntry>, enableFuzzy: boolean, fuzzyMaxDistance: number) {
    const words = text.split(/\s+/).filter(Boolean);
    const seen = new Set<string>();

    for (const word of words) {
      if (word.length < 2) continue;

      const exactMatches = this.index.lookupExact(word);
      if (exactMatches.length > 0) {
        for (const match of exactMatches) {
          const matchKey = `${match.category}|${match.subcategory}|${word}`;
          if (seen.has(matchKey)) continue;
          seen.add(matchKey);
          this._addScore(scores, match, word, positionWeight);
        }
        continue;
      }

      if (enableFuzzy && word.length >= 4) {
        const fuzzyMatches = this.index.lookupFuzzy(word, fuzzyMaxDistance);
        const bestByCategory = new Map<string, typeof fuzzyMatches[0]>();
        for (const fm of fuzzyMatches) {
          const catKey = `${fm.category}|${fm.subcategory}`;
          if (!bestByCategory.has(catKey) || fm.distance < bestByCategory.get(catKey)!.distance) {
            bestByCategory.set(catKey, fm);
          }
        }
        for (const fm of bestByCategory.values()) {
          const matchKey = `${fm.category}|${fm.subcategory}|${word}`;
          if (seen.has(matchKey)) continue;
          seen.add(matchKey);
          this._addScore(scores, { category: fm.category, subcategory: fm.subcategory, weight: fm.weight, source: "fuzzy" }, `${word}→${fm.matched}`, positionWeight);
        }
      }
    }
  }

  private _addScore(scores: Map<string, ScoreEntry>, match: IndexEntry, term: string, positionWeight: number) {
    const key = `${match.category}|${match.subcategory}`;
    const score = match.weight * positionWeight;
    this._ensureEntry(scores, key, match.category, match.subcategory);
    const entry = scores.get(key)!;
    entry.rawScore += score;
    entry.matchCount++;
    entry.matches.push({ term, source: match.source, weight: Math.round(score * 100) / 100 });
  }

  private _ensureEntry(scores: Map<string, ScoreEntry>, key: string, category: string, subcategory: string) {
    if (!scores.has(key)) {
      scores.set(key, {
        category, subcategory, rawScore: 0, finalScore: 0, matchCount: 0, matches: [],
        categoryPriority: this._getCategoryPriority(category),
        subcategoryPriority: this._getSubcategoryPriority(category, subcategory),
      });
    }
  }

  private _resolveConflicts(entries: ScoreEntry[]): ScoreEntry[] {
    return entries.sort((a, b) => {
      const scoreDiff = b.finalScore - a.finalScore;
      if (Math.abs(scoreDiff) > 0.5) return scoreDiff;
      const catPriority = a.categoryPriority - b.categoryPriority;
      if (catPriority !== 0) return catPriority;
      return a.subcategoryPriority - b.subcategoryPriority;
    });
  }

  private _computeConfidence(result: ScoreEntry, allResults: ScoreEntry[]): number {
    const topScore = result.finalScore;
    const absoluteConf = Math.min(topScore / WEIGHTS.highConfidence, 1.0);
    let relativeConf = 1.0;
    if (allResults.length > 1 && allResults[0] === result && allResults[1].finalScore > 0) {
      relativeConf = 1 - allResults[1].finalScore / topScore;
    }
    return Math.round((absoluteConf * 0.6 + relativeConf * 0.4) * 100) / 100;
  }

  private _getCategoryPriority(categoryName: string): number {
    return this.categories.find((c) => c.name === categoryName)?.priority ?? 99;
  }

  private _getSubcategoryPriority(categoryName: string, subcategoryName: string): number {
    const cat = this.categories.find((c) => c.name === categoryName);
    return (cat?.subcategories ?? []).find((s) => s.name === subcategoryName)?.priority ?? 99;
  }
}

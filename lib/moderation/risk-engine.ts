/**
 * Moteur de risque — agrégation unifiée des signaux de modération.
 *
 * Les détecteurs du projet produisent chacun des signaux indépendants
 * (`moderation.ts`, `spam-detector.ts`, `url-scanner.ts`, `scam-patterns.ts`,
 * `simhash.ts`…). Ce moteur les fusionne en un `riskScore` 0–100 unique et
 * une décision (`allow` / `shadow` / `review` / `block`).
 *
 * Trois principes :
 *   1. Atténuation par catégorie — un signal scam fort > trois signaux faibles.
 *      Empêche un fraudeur d'empiler des micro-signaux pour rester sous seuil.
 *   2. Amortissement par la confiance — un vendeur ancien et propre voit son
 *      risque réduit (jusqu'à −80 %). Évite les faux positifs sur les habitués.
 *   3. Normalisation logistique — sortie bornée 0–100, seuils stables.
 *
 * Aucune IA générative : poids déclaratifs, calcul déterministe, auditable.
 */

export type RiskCategory =
  | "scam"
  | "spam"
  | "phishing"
  | "fake_account"
  | "bot"
  | "nsfw"
  | "fraud_ring"
  | "quality";

/** Un signal émis par un détecteur. */
export type SignalHit = {
  signalId: string;                     // ex. "url.phishing", "dup.simhash"
  category: RiskCategory;
  score: number;                        // points de risque bruts (> 0)
  evidence?: Record<string, unknown>;   // preuves pour l'audit modérateur
};

export type RiskDecision = "allow" | "shadow" | "review" | "block";

export type RiskResult = {
  riskScore: number;                    // 0–100
  decision: RiskDecision;
  rawScore: number;                     // avant normalisation (debug)
  byCategory: Record<string, number>;   // contribution par catégorie
  hits: SignalHit[];
  topSignals: string[];                 // signaux les plus lourds
};

/** Seuils de décision — surchargeable par appel (config par pays/catégorie). */
export type RiskThresholds = {
  shadow: number;   // ≥ → publié mais déprioritisé
  review: number;   // ≥ → file modérateur humain
  block: number;    // ≥ → refus automatique
};

export const DEFAULT_THRESHOLDS: RiskThresholds = {
  shadow: 30,
  review: 60,
  block: 80,
};

/** Facteur d'atténuation du n-ième signal d'une même catégorie. */
const CATEGORY_DAMPING = 0.7;

/**
 * Agrège des signaux en un score de risque et une décision.
 *
 * @param hits        signaux émis par les détecteurs
 * @param trustScore  trust de l'utilisateur (0–100, cf. `trust-score.ts`)
 * @param thresholds  seuils de décision (défaut : `DEFAULT_THRESHOLDS`)
 */
export function aggregateRisk(
  hits: SignalHit[],
  trustScore = 0,
  thresholds: RiskThresholds = DEFAULT_THRESHOLDS,
): RiskResult {
  // 1. Regroupement par catégorie + atténuation des signaux empilés.
  const grouped = new Map<RiskCategory, SignalHit[]>();
  for (const h of hits) {
    const arr = grouped.get(h.category) ?? [];
    arr.push(h);
    grouped.set(h.category, arr);
  }

  const byCategory: Record<string, number> = {};
  let rawScore = 0;
  for (const [cat, catHits] of grouped) {
    const sorted = [...catHits].sort((a, b) => b.score - a.score);
    const catScore = sorted.reduce(
      (sum, h, i) => sum + h.score * Math.pow(CATEGORY_DAMPING, i),
      0,
    );
    byCategory[cat] = Math.round(catScore);
    rawScore += catScore;
  }

  // 2. Amortissement par la confiance — au plus −80 % pour un compte "vetted".
  const trustDamping = 1 - Math.min(0.8, Math.max(0, trustScore) / 100);
  const damped = rawScore * trustDamping;

  // 3. Normalisation logistique → 0–100, point d'inflexion à 50 points bruts.
  const riskScore = Math.round(100 / (1 + Math.exp(-(damped - 50) / 15)));

  // 4. Décision.
  let decision: RiskDecision = "allow";
  if (riskScore >= thresholds.block) decision = "block";
  else if (riskScore >= thresholds.review) decision = "review";
  else if (riskScore >= thresholds.shadow) decision = "shadow";

  const topSignals = [...hits]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((h) => `${h.signalId}(+${Math.round(h.score)})`);

  return { riskScore, decision, rawScore: Math.round(rawScore), byCategory, hits, topSignals };
}

/** Construit un `SignalHit` — helper concis pour les détecteurs. */
export function signal(
  signalId: string,
  category: RiskCategory,
  score: number,
  evidence?: Record<string, unknown>,
): SignalHit {
  return { signalId, category, score, evidence };
}

/**
 * Sérialise un résultat de risque pour la colonne `adminNote` / l'audit.
 * Lisible par un modérateur humain, sans dépendance externe.
 */
export function explainRisk(result: RiskResult): string {
  const lines = [
    `[RISK] score=${result.riskScore} decision=${result.decision} (brut=${result.rawScore})`,
    `catégories: ${Object.entries(result.byCategory).map(([c, s]) => `${c}=${s}`).join(", ") || "aucune"}`,
    ...result.hits.map(
      (h) => `  · ${h.signalId} [${h.category}] +${Math.round(h.score)}` +
        (h.evidence ? ` ${JSON.stringify(h.evidence)}` : ""),
    ),
  ];
  return lines.join("\n");
}

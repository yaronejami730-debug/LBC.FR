/**
 * Patterns de scam — détection par expressions régulières (FR).
 *
 * Cible : messagerie interne et descriptions d'annonces. Le scam marketplace
 * vit dans les messages — l'arnaqueur cherche à sortir la victime de la
 * plateforme (paiement direct, transporteur fictif, faux SAV…).
 *
 * Un pattern = une *catégorie* d'arnaque, pas un mot-clé isolé : on combine
 * plusieurs mots dans une seule regex pour limiter les faux positifs.
 *
 * Les regex sont compilées une fois au chargement du module.
 */

export type ScamCategory =
  | "off_platform_pay"  // paiement hors plateforme
  | "courier_scam"      // faux transporteur / faux frais de livraison
  | "advance_fee"       // arnaque à l'acompte / caution
  | "phishing"          // vol d'identifiants
  | "overpayment"       // arnaque au trop-perçu (chèque, virement gonflé)
  | "contact_leak"      // coordonnées en clair (contournement messagerie)
  | "urgency";          // pression / urgence artificielle

export type ScamPattern = {
  id: string;
  category: ScamCategory;
  weight: number;       // points de risque
  re: RegExp;
  label: string;        // explication lisible pour le modérateur
};

export const SCAM_PATTERNS: ScamPattern[] = [
  {
    id: "off_platform_pay",
    category: "off_platform_pay",
    weight: 50,
    re: /\b(western\s*union|mandat\s*cash|payer?\s*(en\s*)?direct|hors\s*(du\s*)?site|en\s*dehors\s*(du|de\s*la)\s*(site|plateforme)|paypal\s*(entre\s*)?ami|virement\s*direct)\b/i,
    label: "Incitation au paiement hors plateforme",
  },
  {
    id: "courier_scam",
    category: "courier_scam",
    weight: 45,
    re: /\b(mon\s*(transporteur|coursier|livreur)|via\s*mon\s*transporteur|frais\s*de\s*(livraison|douane|transport)\s*(à|a)\s*(payer|régler|verser)|société\s*de\s*transport\s*va\s*vous\s*contacter)\b/i,
    label: "Faux transporteur / frais de livraison fictifs",
  },
  {
    id: "advance_fee",
    category: "advance_fee",
    weight: 40,
    re: /\b(acompte|caution|arrhes|avance|frais\s*de\s*dossier)\b.{0,40}\b(avant|pour\s*(réserver|bloquer|garantir)|afin\s*de)\b/i,
    label: "Demande d'acompte avant transaction",
  },
  {
    id: "phishing_verify",
    category: "phishing",
    weight: 55,
    re: /\b(vérifie[rz]?\s*(ton|votre)\s*(compte|identité|paiement)|code\s*(de\s*)?(confirmation|sécurité|vérification)|cliquez?\s*(ici|sur\s*ce\s*lien)|identifiant\s*et\s*mot\s*de\s*passe|connecte[rz]?-?vous\s*(sur|via))\b/i,
    label: "Tentative de phishing / vol d'identifiants",
  },
  {
    id: "overpayment",
    category: "overpayment",
    weight: 45,
    re: /\b(je\s*vous\s*ai\s*envoyé\s*trop|trop\s*[\- ]?perçu|rembourser?\s*la\s*différence|chèque\s*de\s*banque\s*(plus|supérieur)|montant\s*en\s*trop)\b/i,
    label: "Arnaque au trop-perçu",
  },
  {
    id: "urgency",
    category: "urgency",
    weight: 20,
    re: /\b(très\s*urgent|dernière\s*chance|offre\s*expire|réponse\s*immédiate|dépêche[rz]?[\- ]?vous|avant\s*ce\s*soir\s*sinon)\b/i,
    label: "Pression / urgence artificielle",
  },
];

/** Coordonnées en clair — contournement de la messagerie interne. */
const PHONE_RE = /(?:(?:\+33|0033|0)\s*[1-9](?:[\s.\-]*\d{2}){4})|\b\d{10}\b/;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
/** Coordonnées « obfusquées » : "zero six", "06 au point fr", "arobase"… */
const OBFUSCATED_CONTACT_RE =
  /\b(zero|un|deux|trois|quatre|cinq|six|sept|huit|neuf)(\s+(zero|un|deux|trois|quatre|cinq|six|sept|huit|neuf)){6,}\b|\barobase\b|\b(point|at)\s*(fr|com|gmail)\b/i;

export type ScamHit = {
  patternId: string;
  category: ScamCategory;
  score: number;
  label: string;
  match: string;        // extrait déclencheur (pour l'audit)
};

export type ScamScanReport = {
  hits: ScamHit[];
  totalScore: number;
  categories: ScamCategory[];
};

/**
 * Scanne un texte (message ou description) contre tous les patterns de scam.
 *
 * Agrégation atténuée par catégorie : deux patterns de la même catégorie
 * n'empilent pas leur poids plein (le second compte 60 %), pour éviter qu'un
 * texte verbeux gonfle artificiellement le score.
 */
export function scanScam(text: string): ScamScanReport {
  const hits: ScamHit[] = [];

  for (const p of SCAM_PATTERNS) {
    const m = p.re.exec(text);
    if (m) {
      hits.push({
        patternId: p.id,
        category: p.category,
        score: p.weight,
        label: p.label,
        match: m[0],
      });
    }
  }

  // Détection de coordonnées en clair.
  const phone = PHONE_RE.exec(text);
  const email = EMAIL_RE.exec(text);
  const obfuscated = OBFUSCATED_CONTACT_RE.exec(text);
  if (phone || email || obfuscated) {
    const m = phone ?? email ?? obfuscated!;
    hits.push({
      patternId: "contact_leak",
      category: "contact_leak",
      score: obfuscated ? 30 : 20,
      label: "Coordonnées en clair (contournement de la messagerie)",
      match: m[0],
    });
  }

  // Agrégation atténuée par catégorie.
  const byCat = new Map<ScamCategory, number[]>();
  for (const h of hits) {
    const arr = byCat.get(h.category) ?? [];
    arr.push(h.score);
    byCat.set(h.category, arr);
  }
  let totalScore = 0;
  for (const scores of byCat.values()) {
    scores.sort((a, b) => b - a);
    totalScore += scores.reduce((s, v, i) => s + v * Math.pow(0.6, i), 0);
  }

  return {
    hits,
    totalScore: Math.round(Math.min(100, totalScore)),
    categories: [...byCat.keys()],
  };
}

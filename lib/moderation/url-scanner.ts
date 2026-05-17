/**
 * Scanner d'URL — détection de phishing et de liens frauduleux.
 *
 * Pipeline en passes, du moins cher au plus cher :
 *   1. whitelist        → O(1), aucun risque
 *   2. blacklist exacte → O(1), risque maximal
 *   3. typosquat        → Levenshtein contre les marques connues
 *   4. heuristiques host → raccourcisseur, IP littérale, homoglyphes, entropie…
 *
 * Aucune dépendance réseau : tout est local et synchrone (compatible hot path).
 * Les listes sont des `Set` en mémoire — en production, les alimenter depuis
 * la table `blacklist` (chargée au boot) + un cron qui pull les flux externes
 * (ex. Discord-AntiScam/scam-links).
 */

/** Domaines de confiance — jamais pénalisés (le site lui-même, partenaires). */
export const URL_WHITELIST = new Set<string>([
  "dealandcompany.fr",
  "www.dealandcompany.fr",
]);

/** Domaines bannis — match exact, score maximal. Alimentés depuis la DB. */
export const URL_BLACKLIST = new Set<string>();

/**
 * Remplace la blacklist en mémoire (appelé par `lib/moderation/blacklist.ts`
 * après chargement depuis la table `Blacklist`). Garde `scanUrl` synchrone.
 */
export function primeUrlBlacklist(domains: Iterable<string>): void {
  URL_BLACKLIST.clear();
  for (const d of domains) {
    const host = d.trim().toLowerCase();
    if (host) URL_BLACKLIST.add(host);
  }
}

/** Raccourcisseurs d'URL — masquent la destination réelle. */
const SHORTENERS = new Set<string>([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
  "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy", "tiny.cc", "burl.co",
]);

/** Marques / domaines légitimes souvent imités (cibles de typosquat). */
const TYPOSQUAT_TARGETS = [
  "leboncoin.fr", "paypal.com", "lacentrale.fr", "vinted.fr", "amazon.fr",
  "dealandcompany.fr", "laposte.fr", "colissimo.fr", "chronopost.fr",
  "mondialrelay.fr", "ameli.fr", "impots.gouv.fr",
];

export type UrlVerdict = {
  url: string;
  host: string;
  score: number;                       // points de risque (0 = sûr)
  reasons: string[];                   // pour l'audit modérateur
};

const URL_REGEX = /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi;

/** Extrait toutes les URLs d'un texte libre. */
export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) ?? [];
}

/** Distance de Levenshtein bornée — sort tôt si la distance dépasse `max`. */
function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + cost);
      diag = tmp;
      if (prev[j] < rowMin) rowMin = prev[j];
    }
    if (rowMin > max) return max + 1; // toute la ligne dépasse → abandon
  }
  return prev[b.length];
}

/** Entropie de Shannon — détecte les domaines générés algorithmiquement (DGA). */
function entropy(s: string): number {
  const freq: Record<string, number> = {};
  for (const ch of s) freq[ch] = (freq[ch] ?? 0) + 1;
  let e = 0;
  for (const ch in freq) {
    const p = freq[ch] / s.length;
    e -= p * Math.log2(p);
  }
  return e;
}

/** Normalise une URL brute en hostname minuscule. */
function hostOf(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `http://${url}`);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Analyse une URL isolée et renvoie son verdict de risque.
 * Renvoie `null` si l'URL est sûre (whitelist ou aucun signal).
 */
export function scanUrl(url: string): UrlVerdict | null {
  const host = hostOf(url);
  if (!host) return { url, host: "", score: 15, reasons: ["url_malformee"] };

  if (URL_WHITELIST.has(host)) return null;

  const reasons: string[] = [];
  let score = 0;

  // 2. Blacklist exacte → score plafond.
  if (URL_BLACKLIST.has(host)) {
    return { url, host, score: 80, reasons: ["domaine_blackliste"] };
  }

  const registrable = host.replace(/^www\./, "");

  // 3. Typosquat — proche d'une marque connue sans être identique.
  for (const target of TYPOSQUAT_TARGETS) {
    if (registrable === target) break; // domaine légitime exact
    const d = levenshtein(registrable, target, 2);
    if (d >= 1 && d <= 2) {
      reasons.push(`typosquat:${target}(d=${d})`);
      score += 50;
      break;
    }
  }

  // 4. Heuristiques host.
  if (SHORTENERS.has(registrable)) {
    reasons.push("raccourcisseur_url");
    score += 30;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    reasons.push("ip_litterale");
    score += 25;
  }
  if (host.split(".").length > 4) {
    reasons.push("sous_domaines_excessifs");
    score += 15;
  }
  if (/[а-яёĳ]/i.test(host)) {
    reasons.push("homoglyphes_non_latins");
    score += 40;
  }
  if (host.startsWith("xn--") || host.includes(".xn--")) {
    reasons.push("punycode");
    score += 20;
  }
  const labelSansTld = registrable.split(".")[0] ?? "";
  if (labelSansTld.length >= 10 && entropy(labelSansTld) > 3.5) {
    reasons.push("domaine_haute_entropie");
    score += 20;
  }
  if (/-(secure|login|verify|account|update|confirm|paiement|connexion)/i.test(host)) {
    reasons.push("mot_cle_phishing_dans_host");
    score += 25;
  }

  return score > 0 ? { url, host, score, reasons } : null;
}

export type UrlScanReport = {
  urls: string[];
  verdicts: UrlVerdict[];
  totalScore: number;     // plafonné — un seul lien dangereux suffit
  worst: UrlVerdict | null;
};

/** Scanne toutes les URLs d'un texte et agrège le risque. */
export function scanText(text: string): UrlScanReport {
  const urls = extractUrls(text);
  const verdicts = urls
    .map(scanUrl)
    .filter((v): v is UrlVerdict => v !== null);

  // Pas une somme : 3 liens douteux ≠ menace × 3. On prend le pire + bonus.
  const sorted = [...verdicts].sort((a, b) => b.score - a.score);
  const totalScore = sorted.length
    ? Math.min(100, sorted[0].score + (sorted.length - 1) * 10)
    : 0;

  return { urls, verdicts, totalScore, worst: sorted[0] ?? null };
}

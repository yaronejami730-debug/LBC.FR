/**
 * Normalisation FR + expansion d'abréviations pour la catégorisation d'annonces.
 *
 * Couche en amont du classifier : transforme le langage réel des annonceurs
 * ("pc av bmw", "sech linge bosh", "appart f3") en texte canonique que
 * l'index inversé du classifier sait matcher.
 *
 * Aucune IA générative — dictionnaire curé + remplacement déterministe.
 */

// ─────────────────────────────────────────────────────────────
// 1. FOLD ACCENTS
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

/** Minuscule + suppression des accents. Conserve chiffres et tirets. */
export function foldAccents(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/[àâäáãèêëéìîïíòôöóõùûüúýÿñçœæšžð]/g, (ch) => ACCENT_MAP[ch] ?? ch);
}

/** foldAccents + apostrophes/guillemets → espace + espaces compactés. */
function normalizeForMatch(text: string): string {
  return foldAccents(text)
    .replace(/[''""«»„…]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────
// 2. DICTIONNAIRE D'ABRÉVIATIONS
// ─────────────────────────────────────────────────────────────
//
// Clé = forme abrégée normalisée (minuscule, sans accent).
// Valeur = forme canonique attendue par le classifier.
// Les variantes avec/sans tiret sont listées explicitement.
// Termes trop ambigus volontairement exclus (ex : "av", "lv", "tel", "ch").

const ABBREVIATIONS: Record<string, string> = {
  // ── Pièces & équipement auto ──────────────────────────────
  "pc av": "pare-chocs avant",
  "pc ar": "pare-chocs arriere",
  "pare choc": "pare-chocs",
  "boite auto": "boite automatique",
  "boite meca": "boite mecanique",
  "bv": "boite de vitesses",
  "ct ok": "controle technique ok",
  "ct": "controle technique",
  "clim": "climatisation",
  "jantes alu": "jantes aluminium",
  "retro": "retroviseur",
  "util": "utilitaire",
  "4 roues motrices": "4x4",

  // ── Immobilier ────────────────────────────────────────────
  "appart": "appartement",
  "apt": "appartement",
  "rdc": "rez-de-chaussee",
  "sdb": "salle de bain",
  "sde": "salle d eau",
  "cuis": "cuisine",
  "chbre": "chambre",
  "chbr": "chambre",
  "m2": "metre carre",
  "balc": "balcon",
  "pkg": "parking",
  "loc": "location",
  "coloc": "colocation",

  // ── Électroménager ────────────────────────────────────────
  "sech linge": "seche-linge",
  "seche linge": "seche-linge",
  "lave linge": "lave-linge",
  "machine a laver": "lave-linge",
  "lave vaisselle": "lave-vaisselle",
  "micro onde": "micro-ondes",
  "micro ondes": "micro-ondes",
  "frigo": "refrigerateur",
  "congel": "congelateur",
  "elec": "electrique",
  "elecromenager": "electromenager",

  // ── Multimédia / informatique ─────────────────────────────
  "ordi": "ordinateur",
  "pc portable": "ordinateur portable",
  "pc fixe": "ordinateur fixe",
  "pc gamer": "ordinateur gamer",
  "dd": "disque dur",
  "cg": "carte graphique",
  "cm": "carte mere",
  "alim": "alimentation",

  // ── État & conditions de vente ────────────────────────────
  "tbe": "tres bon etat",
  "be": "bon etat",
  "ebe": "excellent etat",
  "nego": "negociable",
  "negociable": "negociable",
  "px": "prix",
  "dispo": "disponible",
  "occas": "occasion",
  "occaz": "occasion",
  "neuf jamais servi": "neuf",

  // ── Mode ──────────────────────────────────────────────────
  "vtmt": "vetement",
  "vetmt": "vetement",
  "pointure": "pointure",
};

// ─────────────────────────────────────────────────────────────
// 3. INDEX DE REMPLACEMENT (compilé une fois)
// ─────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type Rule = { re: RegExp; replacement: string };

// Trié par nombre de mots décroissant : les phrases longues d'abord
// ("pc av" remplacé avant qu'une éventuelle règle "pc" ne s'applique).
const RULES: Rule[] = Object.entries(ABBREVIATIONS)
  .map(([key, value]) => ({ key, value, words: key.split(/[\s-]/).length }))
  .sort((a, b) => b.words - a.words)
  .map(({ key, value }) => ({
    re: new RegExp(`\\b${escapeRegex(key)}\\b`, "g"),
    replacement: value,
  }));

// ─────────────────────────────────────────────────────────────
// 4. API PUBLIQUE
// ─────────────────────────────────────────────────────────────

/**
 * Étend les abréviations FR d'un texte d'annonce.
 *
 * @example
 *   expandAbbreviations("pc av bmw f20")      → "pare-chocs avant bmw f20"
 *   expandAbbreviations("sech linge bosh")    → "seche-linge bosh"
 *   expandAbbreviations("appart f3 tbe")      → "appartement f3 tres bon etat"
 */
export function expandAbbreviations(text: string): string {
  if (!text || typeof text !== "string") return "";
  let out = normalizeForMatch(text);
  for (const { re, replacement } of RULES) {
    out = out.replace(re, replacement);
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Nombre d'abréviations connues — utile pour les tests / diagnostics. */
export const ABBREVIATION_COUNT = RULES.length;

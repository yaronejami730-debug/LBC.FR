/**
 * Extraction de références produit depuis le texte OCR brut.
 *
 * Détecte : références OEM, numéros de série, IMEI, codes EAN, séquences
 * numériques et codes alphanumériques. Regex pures — aucune IA générative.
 *
 * @example
 *   extractReferences("Réf. 0445110298  S/N: AB12CD34")
 *   → [{ value: "0445110298", type: "oem", label: "Réf" },
 *      { value: "AB12CD34", type: "serial", label: "S/N" }]
 */

export type ReferenceType = "oem" | "serial" | "imei" | "ean" | "numeric" | "alphanumeric";

export type ExtractedReference = {
  /** Valeur normalisée : majuscules, sans espace. */
  value: string;
  /** Catégorie détectée. */
  type: ReferenceType;
  /** Étiquette de proximité dans le texte (« Réf », « S/N »…), si présente. */
  label?: string;
};

// Étiquette + valeur : « Réf : 0445110298 », « S/N AB12CD34 »…
// La valeur n'accepte pas d'espace (sinon la capture mange les mots suivants).
const LABEL_RE =
  /\b(r[ée]f(?:[ée]rence)?|s\/?n|serial|n[°o]?\s*s[ée]rie|part\s*(?:number|no|n[°o])?|oem|article)\b\.?\s*[:#=-]?\s*([A-Za-z0-9][A-Za-z0-9.\-/]{3,24}[A-Za-z0-9])/gi;

// Séquences numériques 8-15 chiffres.
const NUMERIC_RE = /\b\d{8,15}\b/g;

// Codes alphanumériques (lettres + chiffres), tirets autorisés.
const ALPHANUM_RE = /\b[A-Za-z0-9][A-Za-z0-9-]{4,19}\b/g;

export function extractReferences(text: string): ExtractedReference[] {
  if (!text || typeof text !== "string") return [];

  const out: ExtractedReference[] = [];
  const seen = new Set<string>();

  const add = (raw: string, type: ReferenceType, label?: string) => {
    const value = raw.replace(/\s+/g, "").toUpperCase();
    if (value.length < 5 || seen.has(value)) return;
    seen.add(value);
    out.push(label ? { value, type, label } : { value, type });
  };

  // 1. Références étiquetées (priorité — le label désambiguïse le type).
  for (const m of text.matchAll(LABEL_RE)) {
    const label = m[1].toLowerCase();
    const type: ReferenceType = /s\/?n|serial|s[ée]rie/.test(label) ? "serial" : "oem";
    add(m[2], type, m[1].trim());
  }

  // 2. Séquences numériques — IMEI (15), EAN (13), sinon OEM numérique.
  for (const m of text.matchAll(NUMERIC_RE)) {
    const d = m[0];
    const type: ReferenceType = d.length === 15 ? "imei" : d.length === 13 ? "ean" : "numeric";
    add(d, type);
  }

  // 3. Codes alphanumériques mixtes (au moins une lettre ET un chiffre).
  for (const m of text.matchAll(ALPHANUM_RE)) {
    const t = m[0];
    if (!/[A-Za-z]/.test(t) || !/\d/.test(t)) continue;
    add(t, "alphanumeric");
  }

  return out;
}

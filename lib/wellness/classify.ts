/**
 * Classification fine des annonces « Bien-être & Beauté ».
 *
 * Rend, à partir du texte libre :
 *   sous-catégorie → type d'annonce → nature de l'offre, format, tarif, durée,
 *   capacité, public visé.
 *
 * Aucun appel réseau, aucun modèle génératif : index de motifs construit une
 * fois au chargement, comparaison sur texte normalisé. Le moteur doit tourner
 * sur le chemin de publication, où chaque milliseconde compte.
 *
 * Le tarif affiché sur l'annonce reste celui du champ prix ; ce module en
 * déduit ce qu'il *représente* (à l'heure, par personne, à partir de…) et
 * calcule le prix par personne quand la capacité est connue.
 */

import { foldAccents } from "@/lib/normalize-fr";
import {
  WELLNESS_SUBCATEGORIES,
  FORMAT_PATTERNS,
  RENTAL_PATTERNS,
  MODEL_SEARCH_PATTERNS,
  PRODUCT_SALE_PATTERNS,
  type Audience,
  type OfferKind,
} from "./taxonomy";

export type PriceUnit =
  | "seance"
  | "heure"
  | "30min"
  | "2h"
  | "demi_journee"
  | "journee"
  | "personne"
  | "couple"
  | "groupe"
  | "mois";

export type TariffType = "fixe" | "par_heure" | "par_personne" | "par_seance" | "a_partir_de" | "forfait";

export type WellnessClassification = {
  /** Libellé de sous-catégorie, aligné sur lib/categories.ts. */
  subcategory: string;
  subcategoryId: string;
  emoji: string;
  /** Type d'annonce (niveau 3), null si seule la sous-catégorie est sûre. */
  type: string | null;
  typeId: string | null;
  /** Types secondaires détectés — « pose de gel + french » en donne deux. */
  extraTypes: string[];
  offerKind: OfferKind;
  audience: Audience;
  /** Formats cumulables : privatif, duo, à domicile… */
  formats: string[];
  /** Durée totale en minutes, si annoncée. */
  durationMin: number | null;
  /** Nombre de personnes couvertes par le prix, si annoncé. */
  capacity: number | null;
  tariffType: TariffType;
  priceUnit: PriceUnit | null;
  /** Prix lu dans le texte (à défaut, celui du champ prix de l'annonce). */
  price: number | null;
  /** Prix ramené à la personne, si capacité connue. */
  pricePerPerson: number | null;
  /** 0 → aucun signal, 1 → sous-catégorie et type francs. */
  confidence: number;
  /** Étiquettes prêtes à afficher. */
  tags: string[];
};

// ─────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────

/** Minuscules, sans accents, ponctuation réduite à des espaces. */
export function normalize(text: string): string {
  return ` ${foldAccents(text)
    .replace(/[^a-z0-9€%+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function hasAny(haystack: string, patterns: string[]): boolean {
  return patterns.some((p) => haystack.includes(` ${p.trim()} `) || haystack.includes(p));
}

// ─────────────────────────────────────────────────────────────
// Index type → motifs (le plus long l'emporte)
// ─────────────────────────────────────────────────────────────

type IndexedType = {
  subId: string;
  subLabel: string;
  emoji: string;
  typeId: string;
  typeLabel: string;
  pattern: string;
  weight: number;
};

const TYPE_INDEX: IndexedType[] = WELLNESS_SUBCATEGORIES.flatMap((sub) =>
  sub.types.flatMap((type) =>
    type.patterns.map((p) => {
      const pattern = normalize(p).trim();
      return {
        subId: sub.id,
        subLabel: sub.label,
        emoji: sub.emoji,
        typeId: type.id,
        typeLabel: type.label,
        pattern,
        // Un motif long est plus discriminant : « massage aux pierres chaudes »
        // désigne un type, « massage » une rubrique.
        weight: pattern.split(" ").length,
      };
    }),
  ),
).sort((a, b) => b.pattern.length - a.pattern.length);

const SUB_INDEX = WELLNESS_SUBCATEGORIES.flatMap((sub) =>
  sub.keywords.map((k) => ({
    subId: sub.id,
    subLabel: sub.label,
    emoji: sub.emoji,
    pattern: normalize(k).trim(),
  })),
).sort((a, b) => b.pattern.length - a.pattern.length);

// ─────────────────────────────────────────────────────────────
// Extraction tarif / durée / capacité
// ─────────────────────────────────────────────────────────────

const PRICE_RE = /(\d{1,5})(?:[.,](\d{1,2}))?\s*(?:€|eur\b|euros?\b)/g;

/** Durées écrites « 1h30 », « 90 min », « 2 heures », « demi journee ». */
function extractDuration(text: string): number | null {
  const hm = text.match(/\b(\d{1,2})\s*h\s*([0-5]\d)\b/);
  if (hm) return parseInt(hm[1]) * 60 + parseInt(hm[2]);

  const h = text.match(/\b(\d{1,2})(?:[.,](\d))?\s*(?:h\b|heures?\b)/);
  if (h) {
    const base = parseInt(h[1]) * 60;
    return h[2] ? base + parseInt(h[2]) * 6 : base;
  }

  const min = text.match(/\b(\d{2,3})\s*(?:min\b|minutes?\b)/);
  if (min) return parseInt(min[1]);

  if (/\bdemi journee\b|\bdemie journee\b/.test(text)) return 240;
  if (/\bjournee\b|\ba la journee\b/.test(text)) return 480;
  return null;
}

/** Capacité : « 2 personnes », « pour 4 », « duo », « couple ». */
function extractCapacity(text: string): number | null {
  const m = text.match(/\b(?:pour\s*)?(\d{1,2})\s*(?:personnes?|pers\b|places?)\b/);
  if (m) {
    const n = parseInt(m[1]);
    if (n >= 1 && n <= 30) return n;
  }
  if (/\bduo\b|\ba deux\b|\ben couple\b|\ben amoureux\b|\bcouple\b/.test(text)) return 2;
  if (/\bsolo\b|\b1 personne\b|\bindividuel\b/.test(text)) return 1;
  return null;
}

function extractPrices(text: string): number[] {
  const out: number[] = [];
  PRICE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PRICE_RE.exec(text))) {
    const value = parseFloat(`${m[1]}.${m[2] ?? "0"}`);
    if (value > 0 && value < 100_000) out.push(value);
  }
  return out;
}

function extractPriceUnit(text: string, duration: number | null): PriceUnit | null {
  if (/\bde l heure\b|\bpar heure\b|\bl heure\b|\/\s*h\b|\bheure\b/.test(text)) return "heure";
  if (/\bpar personne\b|\bpers\b|\bpar pers\b/.test(text)) return "personne";
  if (/\bpar seance\b|\bla seance\b|\ba la seance\b/.test(text)) return "seance";
  if (/\bdemi journee\b/.test(text)) return "demi_journee";
  if (/\bjournee\b/.test(text)) return "journee";
  if (/\bpar mois\b|\bmensuel\b|\b\/\s*mois\b/.test(text)) return "mois";
  if (duration === 30) return "30min";
  if (duration === 120) return "2h";
  if (duration === 60) return "heure";
  return duration ? "seance" : null;
}

function extractTariffType(text: string, unit: PriceUnit | null): TariffType {
  if (/\ba partir de\b|\bdes \d/.test(text)) return "a_partir_de";
  if (/\bforfait\b|\bpack\b|\bcarte de \d+ seances\b|\babonnement\b/.test(text)) return "forfait";
  if (unit === "heure") return "par_heure";
  if (unit === "personne") return "par_personne";
  if (unit === "seance" || unit === "30min" || unit === "2h") return "par_seance";
  return "fixe";
}

// ─────────────────────────────────────────────────────────────
// Classification
// ─────────────────────────────────────────────────────────────

/**
 * Analyse une annonce. Renvoie `null` si rien ne rattache le texte à la
 * rubrique — l'appelant retombe alors sur le classifieur généraliste.
 */
export function classifyWellness({
  title,
  description = "",
  price = null,
}: {
  title: string;
  description?: string;
  price?: number | null;
}): WellnessClassification | null {
  const text = normalize(`${title} ${description}`);
  const titleText = normalize(title);
  if (text.trim().length < 3) return null;

  // 1. Type d'annonce — le motif le plus long gagne, le titre prime.
  const typeHits = TYPE_INDEX.filter((e) => text.includes(e.pattern));
  const titleHits = typeHits.filter((e) => titleText.includes(e.pattern));
  const primary = (titleHits[0] ?? typeHits[0]) ?? null;

  // 2. Sous-catégorie — celle du type, sinon un mot-clé de rubrique.
  let subId = primary?.subId ?? null;
  let subLabel = primary?.subLabel ?? null;
  let emoji = primary?.emoji ?? "";
  let subInTitle = false;
  if (!subId) {
    const subHit = SUB_INDEX.find((e) => text.includes(e.pattern));
    if (!subHit) return null;
    subId = subHit.subId;
    subLabel = subHit.subLabel;
    emoji = subHit.emoji;
    subInTitle = titleText.includes(subHit.pattern);
  }

  // 3. Nature de l'offre. La location d'un poste de travail l'emporte sur la
  //    prestation : « cabine de massage à louer » n'est pas un massage vendu.
  const isRental = hasAny(text, RENTAL_PATTERNS);
  const isModelSearch = hasAny(text, MODEL_SEARCH_PATTERNS);
  const isProductSale = hasAny(text, PRODUCT_SALE_PATTERNS) && !isRental;

  // Une location d'espace se reconnaît au *lieu de travail* loué, pas au verbe :
  // « privatisation hammam » vend une séance à des clients, « cabine à louer »
  // loue un poste à une esthéticienne.
  const rentsWorkspace =
    (isRental &&
      /\bcabine\b|\bsalon\b|\bfauteuil\b|\bposte\b|\blocal\b|\binstitut\b|\bsalle de (massage|soin)\b|\bespace beaute\b/.test(
        text,
      )) ||
    subId === "location-espace";

  let offerKind: OfferKind = "prestation";
  if (isProductSale) offerKind = "vente_produit";
  else if (rentsWorkspace) offerKind = "location_espace";
  else if (isModelSearch) offerKind = "recherche_modele";

  if (rentsWorkspace) {
    subId = "location-espace";
    subLabel = "Location d'espace bien-être";
    emoji = "🏢";
  }

  const audience: Audience = rentsWorkspace ? "professionnel" : "particulier";

  // 4. Format, durée, capacité, tarif
  const formats = FORMAT_PATTERNS.filter((f) => hasAny(text, f.patterns)).map((f) => f.label);
  const durationMin = extractDuration(text);
  const capacity = extractCapacity(text);
  const textPrices = extractPrices(text);
  const finalPrice = textPrices.length > 0 ? Math.min(...textPrices) : (price ?? null);
  const priceUnit = extractPriceUnit(text, durationMin);
  const tariffType = extractTariffType(text, priceUnit);
  const pricePerPerson =
    finalPrice && capacity && capacity > 1 && tariffType !== "par_personne"
      ? Math.round((finalPrice / capacity) * 100) / 100
      : null;

  // 5. Confiance : un type trouvé dans le titre est le cas franc ; une simple
  //    correspondance de rubrique reste faible et déclenchera une relecture.
  let confidence = subInTitle ? 0.65 : 0.45;
  if (primary) confidence = titleHits.length > 0 ? 0.9 : 0.7;
  if (primary && primary.weight >= 3) confidence = Math.min(1, confidence + 0.1);
  if (rentsWorkspace) confidence = Math.max(confidence, 0.8);

  const extraTypes = Array.from(
    new Set(
      typeHits
        .filter((e) => e.typeId !== primary?.typeId && e.subId === subId)
        .map((e) => e.typeLabel),
    ),
  ).slice(0, 3);

  const tags = [
    ...formats,
    capacity ? `${capacity} personne${capacity > 1 ? "s" : ""}` : null,
    durationMin ? formatDuration(durationMin) : null,
    offerKind === "location_espace" ? "Entre professionnels" : null,
    offerKind === "recherche_modele" ? "Recherche de modèle" : null,
  ].filter((x): x is string => !!x);

  return {
    subcategory: subLabel!,
    subcategoryId: subId!,
    emoji,
    type: primary?.typeLabel ?? null,
    typeId: primary?.typeId ?? null,
    extraTypes,
    offerKind,
    audience,
    formats,
    durationMin,
    capacity,
    tariffType,
    priceUnit,
    price: finalPrice,
    pricePerPerson,
    confidence: Math.round(confidence * 100) / 100,
    tags,
  };
}

/** « 90 » → « 1 h 30 ». */
export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (min === 240) return "Demi-journée";
  if (min === 480) return "Journée";
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

/** Libellé court du mode de tarification, pour l'affichage. */
export function formatTariff(c: WellnessClassification): string | null {
  if (c.price == null) return null;
  const p = `${c.price.toLocaleString("fr-FR")} €`;
  switch (c.tariffType) {
    case "par_heure":
      return `${p}/h`;
    case "par_personne":
      return `${p}/personne`;
    case "a_partir_de":
      return `À partir de ${p}`;
    case "forfait":
      return `${p} le forfait`;
    case "par_seance":
      return c.durationMin ? `${p} · ${formatDuration(c.durationMin)}` : `${p} la séance`;
    default:
      return p;
  }
}

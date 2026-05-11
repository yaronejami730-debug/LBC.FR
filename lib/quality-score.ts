import type { Category } from "@/lib/categories";

export type QualityInput = {
  title: string;
  description: string;
  price: number;
  category: string;
  subcategory?: string | null;
  location: string;
  images: string[];
  metadata?: Record<string, any>;
  immoSurface?: number | null;
  immoRooms?: number | null;
};

export type QualityResult = {
  score: number;
  breakdown: Record<string, number>;
};

const MIN_IMAGES_BY_CAT: Record<string, number> = {
  immobilier: 3,
  vehicules: 3,
  animaux: 4,
  multimedia: 2,
  mode: 1,
  maison: 1,
  default: 1,
};

function emojiCount(s: string): number {
  // Count common emoji ranges. Cheap & good enough.
  const re = /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/gu;
  return (s.match(re) ?? []).length;
}

export function computeQualityScore(input: QualityInput): QualityResult {
  const breakdown: Record<string, number> = {};
  let s = 50;

  const catId = input.category
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // ── Title ──
  const t = input.title.trim();
  if (t.length >= 20 && t.length <= 80) {
    s += 5;
    breakdown.title_length_ok = 5;
  } else if (t.length < 10) {
    s -= 15;
    breakdown.title_too_short = -15;
  }
  if (t.length >= 4 && t === t.toUpperCase()) {
    s -= 5;
    breakdown.title_all_caps = -5;
  }

  // ── Description ──
  const d = input.description.trim();
  if (d.length >= 300) {
    s += 15;
    breakdown.desc_long = 15;
  } else if (d.length >= 150) {
    s += 8;
    breakdown.desc_medium = 8;
  } else if (d.length < 80) {
    s -= 15;
    breakdown.desc_too_short = -15;
  }
  if (/[!?]{4,}/.test(d)) {
    s -= 5;
    breakdown.desc_excessive_punct = -5;
  }
  if (/(.)\1{5,}/.test(d)) {
    s -= 5;
    breakdown.desc_char_repeat = -5;
  }
  const emojis = emojiCount(t + " " + d);
  if (emojis > 8) {
    s -= 5;
    breakdown.too_many_emojis = -5;
  }

  // ── Images ──
  const minImages = MIN_IMAGES_BY_CAT[catId] ?? MIN_IMAGES_BY_CAT.default;
  if (input.images.length >= minImages + 2) {
    s += 15;
    breakdown.images_plenty = 15;
  } else if (input.images.length >= minImages) {
    s += 8;
    breakdown.images_ok = 8;
  } else if (input.images.length === 0) {
    s -= 30;
    breakdown.no_image = -30;
  } else {
    s -= 15;
    breakdown.images_below_min = -15;
  }

  // ── Category-specific required fields ──
  const meta = input.metadata ?? {};
  if (catId === "vehicules") {
    if (!meta.kilometrage) {
      s -= 10;
      breakdown.veh_no_km = -10;
    }
    if (!meta.annee) {
      s -= 10;
      breakdown.veh_no_year = -10;
    }
    if (!meta.marque) {
      s -= 5;
      breakdown.veh_no_brand = -5;
    }
  }
  if (catId === "immobilier") {
    if (!input.immoSurface) {
      s -= 15;
      breakdown.immo_no_surface = -15;
    }
    if (!input.immoRooms) {
      s -= 5;
      breakdown.immo_no_rooms = -5;
    }
    if (!meta.dpe) {
      s -= 8;
      breakdown.immo_no_dpe = -8;
    }
  }

  // ── Price sanity ──
  if (input.price === 1 || input.price === 0) {
    s -= 12;
    breakdown.price_token = -12;
  }

  // ── Location ──
  if (input.location && input.location.trim().split(/[\s,]+/).length >= 1) {
    s += 5;
    breakdown.has_location = 5;
  } else {
    s -= 5;
    breakdown.no_location = -5;
  }

  const score = Math.max(0, Math.min(100, s));
  return { score, breakdown };
}

export function shouldBeIndexable(opts: {
  status: string;
  shadowBanned: boolean;
  qualityScore: number;
  reportCount: number;
  imageCount: number;
  descriptionLength: number;
}): boolean {
  if (opts.status !== "APPROVED") return false;
  if (opts.shadowBanned) return false;
  if (opts.qualityScore < 40) return false;
  if (opts.imageCount < 1) return false;
  if (opts.descriptionLength < 80) return false;
  if (opts.reportCount >= 3) return false;
  return true;
}

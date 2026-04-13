/**
 * Search/browse history — stored in localStorage.
 * Used to power the "Pour toi" recommendation section on the homepage.
 */

const STORAGE_KEY = "dc_history";
const MAX_ENTRIES = 50;
const MAX_AGE_DAYS = 30;

export interface HistoryEntry {
  category: string; // e.g. "Véhicules"
  t: number;        // timestamp ms
}

function load(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
    return parsed.filter((e) => e.t > cutoff);
  } catch {
    return [];
  }
}

function save(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {}
}

/** Record that the user visited a listing or searched in a given category. */
export function recordVisit(category: string) {
  if (!category) return;
  const entries = load();
  entries.unshift({ category, t: Date.now() });
  save(entries);
}

/** Return top N categories by weighted frequency (recent = more weight). */
export function getTopCategories(n = 3): string[] {
  const entries = load();
  if (entries.length === 0) return [];

  const now = Date.now();
  const scores: Record<string, number> = {};

  for (const e of entries) {
    const ageHours = (now - e.t) / 3_600_000;
    // weight: 3 if < 24h, 2 if < 7d, 1 if < 30d
    const weight = ageHours < 24 ? 3 : ageHours < 168 ? 2 : 1;
    scores[e.category] = (scores[e.category] || 0) + weight;
  }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([cat]) => cat);
}

export function hasHistory(): boolean {
  return load().length > 0;
}

/**
 * Autosuggestion sur les 2 200 prestations PRO.
 *
 * Volontairement séparé de `lib/pro-catalog/index` : ce module ne charge que
 * l'index plat (1,2 Mo) et pas l'arbre complet (2,3 Mo). Les deux parcours qui
 * s'en servent — recherche tapée dans le formulaire, et matching d'un prompt
 * libre — n'ont besoin de rien d'autre.
 */
import { foldAccents } from "@/lib/normalize-fr";
import rawIndex from "@/data/pro-catalog/autosuggest_index.json";
import type { ProSuggestIndex, ProSuggestItem } from "./types";

const INDEX = rawIndex as unknown as ProSuggestIndex;

export const PRO_SUGGEST_VERSION = INDEX.version;
export const PRO_SUGGEST_ITEMS = INDEX.items;

type Entry = {
  item: ProSuggestItem;
  /** label sans accents, minuscule */
  label: string;
  /** mots-clés + libellés de rattachement, sans accents */
  haystack: string;
};

let entries: Entry[] | null = null;

function getEntries(): Entry[] {
  if (entries) return entries;
  entries = INDEX.items.map((item) => ({
    item,
    label: foldAccents(item.label),
    haystack: foldAccents([...item.kw, item.sub, item.cat].join(" ")),
  }));
  return entries;
}

function tokenize(query: string): string[] {
  return foldAccents(query)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1);
}

/** Un token compte s'il commence un mot du libellé ou des mots-clés. */
function tokenScore(entry: Entry, token: string): number {
  if (entry.label === token) return 12;
  if (entry.label.startsWith(token)) return 8;
  if (entry.label.includes(` ${token}`)) return 6;
  if (entry.haystack.startsWith(token) || entry.haystack.includes(` ${token}`)) return 4;
  // Sous-chaîne au milieu d'un mot : accepté pour rattraper les fautes de
  // frappe et les pluriels, mais scoré bas pour ne jamais passer devant un
  // vrai début de mot.
  if (entry.label.includes(token) || entry.haystack.includes(token)) return 1;
  return 0;
}

export type ProSuggestion = ProSuggestItem & { score: number };

export type ProSuggestOptions = {
  limit?: number;
  /** Restreint aux domaines d'activité donnés (boutique pro, catalogue filtré). */
  domains?: string[];
  /** Restreint aux catégories données (`C08`…). */
  categoryIds?: string[];
};

/**
 * Recherche par tokens : tous les mots de la requête doivent matcher, ce qui
 * évite qu'une requête longue ramène 300 résultats vaguement liés. À égalité de
 * score le libellé le plus court gagne — « Coupe femme » avant
 * « Coupe femme — forfait 5 séances ».
 */
export function searchProLeaves(query: string, options: ProSuggestOptions = {}): ProSuggestion[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const limit = options.limit ?? 10;
  const domains = options.domains?.length ? new Set(options.domains) : null;
  const categoryIds = options.categoryIds?.length ? new Set(options.categoryIds) : null;

  const hits: ProSuggestion[] = [];
  for (const entry of getEntries()) {
    if (domains && !domains.has(entry.item.domain)) continue;
    if (categoryIds && !categoryIds.has(entry.item.id.split(".")[0])) continue;

    let score = 0;
    let matchedAll = true;
    for (const token of tokens) {
      const s = tokenScore(entry, token);
      if (s === 0) {
        matchedAll = false;
        break;
      }
      score += s;
    }
    if (!matchedAll) continue;
    hits.push({ ...entry.item, score });
  }

  hits.sort((a, b) => b.score - a.score || a.label.length - b.label.length);
  return hits.slice(0, limit);
}

/**
 * Parcours « prompt libre » : le pro décrit son activité en texte long, on lui
 * propose les prestations les plus proches. Même moteur, mais les mots doivent
 * matcher au moins une fois chacun sans être tous obligatoires — un paragraphe
 * contient trop de mots parasites pour exiger un ET.
 */
export function matchProLeavesFromPrompt(
  prompt: string,
  options: ProSuggestOptions = {},
): ProSuggestion[] {
  const tokens = tokenize(prompt).slice(0, 40);
  if (tokens.length === 0) return [];

  const limit = options.limit ?? 3;
  const domains = options.domains?.length ? new Set(options.domains) : null;
  const categoryIds = options.categoryIds?.length ? new Set(options.categoryIds) : null;

  const hits: ProSuggestion[] = [];
  for (const entry of getEntries()) {
    if (domains && !domains.has(entry.item.domain)) continue;
    if (categoryIds && !categoryIds.has(entry.item.id.split(".")[0])) continue;

    let score = 0;
    let matched = 0;
    for (const token of tokens) {
      const s = tokenScore(entry, token);
      if (s > 0) {
        score += s;
        matched += 1;
      }
    }
    // Un seul mot commun avec un texte de 200 mots ne veut rien dire.
    if (matched < 2) continue;
    hits.push({ ...entry.item, score });
  }

  hits.sort((a, b) => b.score - a.score || a.label.length - b.label.length);
  return hits.slice(0, limit);
}

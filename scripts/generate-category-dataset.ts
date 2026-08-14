/**
 * Génère le jeu d'exemples de catégorisation, puis l'index compact.
 *
 *   npm run category:build
 *
 * Deux sorties, deux usages :
 *
 *  - `data/classifier/dataset.json` — la connaissance, lisible, versionnable,
 *    régénérable. Personne ne la charge à l'exécution.
 *  - `data/classifier/index.json` — ce que le moteur lit vraiment : des
 *    tables terme → nœuds et paire → nœud. Compact, sans phrase.
 *
 * La distinction est le cœur du sujet : parcourir 50 000 titres à chaque
 * frappe serait absurde, alors qu'interroger deux tables de hachage est
 * instantané.
 *
 * Les exemples ne sont pas du remplissage. Chacun est une formulation qu'un
 * vendeur pourrait écrire : « Peugeot 208 GT Line 2022 », « je vends ma clio »,
 * « canappé cuir urgent ». Les combinaisons sont bornées et déduplicées, et un
 * quota par nœud évite qu'une catégorie riche en marques n'écrase les autres.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { KNOWLEDGE, GENERIC_TERMS, DOMINANT_MODIFIERS, COMMON_TYPOS } from "../data/classifier/knowledge";
import { NODES, NODE_BY_KEY } from "../lib/category/taxonomy";

// ── Fabriques de formulations ───────────────────────────────────────────────

/** Tournures commerciales que les vendeurs ajoutent réellement. */
const PREFIXES = ["", "", "", "à vendre", "vends", "urgent", "je vends mon", "je vends ma", "superbe", "belle", "magnifique"];
const SUFFIXES = ["", "", "", "très bon état", "bon état", "comme neuf", "neuf", "peu servi", "prix à débattre", "cause déménagement", "occasion"];
const CITIES = ["", "", "", "Paris", "Lyon", "Marseille", "Toulouse", "Bordeaux", "Lille", "Nantes", "Nice"];
const YEARS = ["", "", "2018", "2019", "2020", "2021", "2022", "2023"];

/** Générateur pseudo-aléatoire déterministe : deux exécutions donnent le même fichier. */
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const rng = makeRng(20260814);

function pick<T>(list: T[]): T {
  return list[Math.floor(rng() * list.length)];
}

/** Variantes orthographiques réellement produites au clavier. */
function typoVariants(term: string): string[] {
  const out: string[] = [];
  const noAccent = term.normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (noAccent !== term) out.push(noAccent);
  // Inversion de deux lettres au milieu — la faute de frappe la plus commune.
  if (term.length > 5) {
    const i = 2 + Math.floor(rng() * (term.length - 4));
    out.push(term.slice(0, i) + term[i + 1] + term[i] + term.slice(i + 2));
  }
  // Consonne doublée, ou dédoublée.
  const doubled = term.replace(/([bcdfglmnprst])/, "$1$1");
  if (doubled !== term && doubled.length <= term.length + 1) out.push(doubled);
  return out;
}

function compose(parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

type Entry = {
  id: number;
  text: string;
  categoryId: string;
  subcategoryId: string;
  keywords: string[];
};

function build(): Entry[] {
  const seen = new Set<string>();
  const entries: Entry[] = [];
  let id = 1;

  const push = (text: string, key: string, keywords: string[]) => {
    const normalized = text.toLowerCase().trim();
    if (normalized.length < 3 || seen.has(normalized)) return;
    const node = NODE_BY_KEY.get(key);
    if (!node) return;
    seen.add(normalized);
    entries.push({
      id: id++,
      text,
      categoryId: node.categoryId,
      subcategoryId: node.subcategoryId,
      keywords: [...new Set(keywords.filter(Boolean))],
    });
  };

  for (const [key, k] of Object.entries(KNOWLEDGE)) {
    const heads = k.heads;
    const mods = k.mods ?? [];
    const brands = k.brands ?? [];
    const models = k.models ?? [];

    for (const head of heads) {
      // 1. Le nom nu — c'est le titre le plus fréquent sur une marketplace.
      push(head, key, [head]);
      push(head + "s", key, [head]);

      // 2. Nom + qualificatif, dans les deux ordres — « robe rouge » et
      //    « rouge robe » ne se valent pas à l'écrit, mais les deux se
      //    rencontrent, et l'ordre ne doit pas décider de la catégorie.
      for (const mod of mods) {
        push(compose([head, mod]), key, [head, mod]);
        push(compose([mod, head]), key, [head, mod]);
        push(compose([head, mod, pick(SUFFIXES)]), key, [head, mod]);
        push(compose([pick(PREFIXES), head, mod]), key, [head, mod]);
      }

      // Deux qualificatifs : « canapé cuir 3 places », le titre le plus courant.
      for (let i = 0; i < Math.min(mods.length, 8); i++) {
        const a = pick(mods), b = pick(mods);
        if (a && b && a !== b) push(compose([head, a, b]), key, [head, a, b]);
      }

      // 3. Nom + tournure commerciale, avec et sans ville.
      for (let i = 0; i < 10; i++) {
        push(compose([pick(PREFIXES), head, pick(SUFFIXES)]), key, [head]);
        push(compose([head, pick(mods) ?? "", pick(CITIES)]), key, [head]);
      }

      // 4. Fautes de frappe : sans elles, « canappé » ne trouve rien, ce qui
      //    est exactement le défaut relevé à l'audit.
      for (const variant of typoVariants(head)) {
        push(variant, key, [head]);
        push(compose([variant, pick(SUFFIXES)]), key, [head]);
        push(compose([variant, pick(mods) ?? ""]), key, [head]);
        push(compose([pick(PREFIXES), variant]), key, [head]);
      }
    }

    // 5. Marques et modèles : la preuve la plus forte quand elle existe.
    for (const brand of brands) {
      push(brand, key, [brand]);
      push(compose([brand, pick(heads)]), key, [brand]);
      for (const model of models) {
        push(compose([brand, model]), key, [brand, model]);
        push(compose([brand, model, pick(YEARS)]), key, [brand, model]);
        push(compose([pick(PREFIXES), brand, model, pick(SUFFIXES)]), key, [brand, model]);
        push(compose([model, brand]), key, [brand, model]);
        push(compose([brand, model, pick(mods) ?? ""]), key, [brand, model]);
        push(compose([brand, model, pick(mods) ?? "", pick(YEARS)]), key, [brand, model]);
        push(compose([model, pick(mods) ?? "", pick(CITIES)]), key, [brand, model]);
      }
      // Marque + nom-tête + qualificatif : « Bosch perceuse sans fil ».
      for (const head of heads.slice(0, 8)) {
        push(compose([brand, head, pick(mods) ?? ""]), key, [brand, head]);
        push(compose([head, brand]), key, [brand, head]);
      }
      for (const variant of typoVariants(brand)) push(variant, key, [brand]);
    }
    for (const model of models) {
      push(model, key, [model]);
      push(compose([model, pick(mods) ?? "", pick(YEARS)]), key, [model]);
      push(compose([pick(PREFIXES), model, pick(SUFFIXES)]), key, [model]);
      for (const mod of mods.slice(0, 6)) push(compose([model, mod]), key, [model, mod]);
    }

    // 6. Titres longs et riches, tels qu'en publient les vendeurs soigneux.
    for (let i = 0; i < 40; i++) {
      push(
        compose([
          pick(PREFIXES),
          pick(brands.length ? brands : heads),
          pick(models.length ? models : heads),
          pick(mods) ?? "",
          pick(mods) ?? "",
          pick(SUFFIXES),
          pick(CITIES),
        ]),
        key,
        [],
      );
    }
  }

  // 7. Cas de bascule : le modificateur dominant l'emporte sur le nom-tête
  //    d'une autre catégorie. « Lit bébé » n'est pas de l'ameublement.
  for (const dom of DOMINANT_MODIFIERS) {
    const targets = NODES.filter((n) => n.categoryId === dom.categoryId);
    for (const node of targets) {
      const k = KNOWLEDGE[node.key];
      if (!k) continue;
      for (const head of k.heads) {
        push(compose([head, dom.term]), node.key, [head, dom.term]);
        push(compose([dom.term, head]), node.key, [head, dom.term]);
        push(compose([head, dom.term, pick(SUFFIXES)]), node.key, [head, dom.term]);
        for (const mod of (k.mods ?? []).slice(0, 5)) {
          push(compose([head, dom.term, mod]), node.key, [head, dom.term, mod]);
        }
      }
    }
  }

  return entries;
}

// ── Index compact ───────────────────────────────────────────────────────────

type IndexFile = {
  version: number;
  builtAt: string;
  /** terme → { clé de nœud → poids } */
  terms: Record<string, Record<string, number>>;
  /** paire « a|b » triée → { clé de nœud → poids } */
  pairs: Record<string, Record<string, number>>;
  generics: string[];
  dominants: { term: string; categoryId: string; rank: number }[];
  typos: Record<string, string>;
  stats: { entries: number; nodes: number; terms: number; pairs: number };
};

/** Poids par nature de preuve. Calibrés au banc d'essai, pas devinés. */
const WEIGHT = { head: 10, model: 9, brand: 7, mod: 4 };

function normalizeTerm(term: string): string {
  return term
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildIndex(entries: Entry[]): IndexFile {
  const terms: Record<string, Record<string, number>> = {};
  const pairs: Record<string, Record<string, number>> = {};

  const add = (table: Record<string, Record<string, number>>, term: string, key: string, weight: number) => {
    const t = normalizeTerm(term);
    if (!t || t.length < 2) return;
    (table[t] ??= {});
    table[t][key] = Math.max(table[t][key] ?? 0, weight);
  };

  for (const [key, k] of Object.entries(KNOWLEDGE)) {
    for (const h of k.heads) add(terms, h, key, WEIGHT.head);
    for (const m of k.mods ?? []) add(terms, m, key, WEIGHT.mod);
    for (const b of k.brands ?? []) add(terms, b, key, WEIGHT.brand);
    for (const m of k.models ?? []) add(terms, m, key, WEIGHT.model);

    // Paires nom-tête × qualificatif : c'est ce qui distingue « table de
    // massage » de « table à manger », et « siège auto » de « siège de bureau ».
    for (const h of k.heads) {
      for (const m of [...(k.mods ?? []), ...(k.brands ?? [])].slice(0, 20)) {
        const [a, b] = [normalizeTerm(h), normalizeTerm(m)].sort();
        if (a && b && a !== b) add(pairs, `${a}|${b}`, key, WEIGHT.head + WEIGHT.mod);
      }
    }
  }

  // Les paires issues des bascules dominantes pèsent davantage : elles sont la
  // règle qui corrige « lit bébé → ameublement ».
  for (const dom of DOMINANT_MODIFIERS) {
    for (const node of NODES.filter((n) => n.categoryId === dom.categoryId)) {
      const k = KNOWLEDGE[node.key];
      if (!k) continue;
      for (const h of k.heads) {
        const [a, b] = [normalizeTerm(h), normalizeTerm(dom.term)].sort();
        if (a && b && a !== b) add(pairs, `${a}|${b}`, node.key, 26);
      }
    }
  }

  return {
    version: 1,
    builtAt: new Date().toISOString(),
    terms,
    pairs,
    generics: GENERIC_TERMS.map(normalizeTerm),
    dominants: DOMINANT_MODIFIERS.map((d) => ({ ...d, term: normalizeTerm(d.term) })),
    typos: Object.fromEntries(Object.entries(COMMON_TYPOS).map(([k, v]) => [normalizeTerm(k), normalizeTerm(v)])),
    stats: {
      entries: entries.length,
      nodes: Object.keys(KNOWLEDGE).length,
      terms: Object.keys(terms).length,
      pairs: Object.keys(pairs).length,
    },
  };
}

// ── Exécution ───────────────────────────────────────────────────────────────

const entries = build();
const index = buildIndex(entries);

mkdirSync("data/classifier", { recursive: true });
writeFileSync("data/classifier/dataset.json", JSON.stringify({ version: 1, entries }, null, 0));
writeFileSync("data/classifier/index.json", JSON.stringify(index, null, 0));

// Répartition : une catégorie écrasante fausserait toute mesure de qualité.
const perCategory = new Map<string, number>();
for (const e of entries) perCategory.set(e.categoryId, (perCategory.get(e.categoryId) ?? 0) + 1);

console.log(`exemples générés : ${entries.length}`);
console.log(`index : ${index.stats.terms} termes · ${index.stats.pairs} paires`);
console.log("répartition par catégorie :");
for (const [cat, n] of [...perCategory.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(6)}  ${cat}`);
}

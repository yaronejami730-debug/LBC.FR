/**
 * Suite de tests du classifieur de types d'annonce.
 *
 *   npm run test:classifier
 *
 * Les cas ne sont pas inventés ici : ils viennent de
 * `data/listing-engine/classifier.lexicon.json → test_suite`, la suite que le
 * brief impose de faire passer à 100 % avant toute mise en production.
 *
 * Trois formes d'assertion, telles que déclarées dans le lexique :
 *   expect_top    — motif de clé que le meilleur candidat doit satisfaire
 *   forbid        — motifs de clé qu'aucun candidat retenu ne doit satisfaire
 *   expect_ask    — identifiant de la règle d'ambiguïté qui doit se déclencher
 */

import { classifyListing } from "../lib/listing-engine/classify";
import lexicon from "../data/listing-engine/classifier.lexicon.json";

type TestCase = {
  input: string;
  expect_top?: string;
  forbid?: string[];
  expect_ask?: string;
  expect_confidence_min?: number;
  note?: string;
};

const SUITE = (lexicon as unknown as { test_suite: TestCase[] }).test_suite;

/** `immobilier.*.appartement` → vrai pour `immobilier.vente.appartement`. */
function matchesPattern(key: string, pattern: string): boolean {
  const re = new RegExp(`^${pattern.split(".").map((s) => (s === "*" ? "[^.]+" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("\\.")}`);
  return re.test(key);
}

let failed = 0;

for (const test of SUITE) {
  const result = classifyListing(test.input);
  const top = result.candidates[0] ?? null;
  const errors: string[] = [];

  if (test.expect_top) {
    if (!top) errors.push(`aucun candidat, attendu ${test.expect_top}`);
    else if (!matchesPattern(top.key, test.expect_top))
      errors.push(`top = ${top.key}, attendu ${test.expect_top}`);
  }

  if (test.forbid) {
    for (const pattern of test.forbid) {
      const hit = result.candidates.find((c) => matchesPattern(c.key, pattern));
      if (hit) errors.push(`candidat interdit retenu : ${hit.key} (motif ${pattern})`);
    }
  }

  if (test.expect_ask) {
    if (result.action !== "ask") errors.push(`action = ${result.action}, attendu ask`);
    else if (result.questionId !== test.expect_ask)
      errors.push(`question = ${result.questionId}, attendue ${test.expect_ask}`);
  }

  if (errors.length > 0) {
    failed++;
    console.log(`\x1b[31m✗\x1b[0m ${test.input}`);
    for (const e of errors) console.log(`    ${e}`);
    console.log(
      `    candidats : ${result.candidates.map((c) => `${c.key}(${c.score.toFixed(2)}/${c.confidence})`).join(" · ") || "aucun"}`,
    );
    console.log(`    texte lexical scoré : «${result.lexicalText.trim()}»`);
    if (test.note) console.log(`    note du pack : ${test.note}`);
  } else {
    const label = top ? `${top.key}` : "—";
    console.log(`\x1b[32m✓\x1b[0m ${test.input.slice(0, 52).padEnd(54)} ${result.action.padEnd(10)} ${label}`);
  }
}

// ── Non-régression sur le bug d'origine ────────────────────────────────
console.log("\n── Toponymes : une ville ne décide jamais d'une catégorie ──");
for (const input of ["Lyon", "Nice", "Fort-de-France", "Metz", "Cannes", "Urgent Lyon", "Vends Grasse"]) {
  const r = classifyListing(input);
  const vehicle = r.candidates.find((c) => c.node.rootSlug === "vehicules");
  if (vehicle) {
    failed++;
    console.log(`\x1b[31m✗\x1b[0m « ${input} » rend éligible ${vehicle.key}`);
  } else if (r.action === "autoselect") {
    failed++;
    console.log(`\x1b[31m✗\x1b[0m « ${input} » sélectionne ${r.chosen.key} sans preuve suffisante`);
  } else {
    console.log(`\x1b[32m✓\x1b[0m « ${input} » → ${r.action}, aucun nœud véhicule éligible`);
  }
}

console.log(
  failed === 0
    ? `\n${SUITE.length} cas du pack + non-régression toponymes : tout passe.`
    : `\n${failed} échec(s).`,
);
process.exit(failed > 0 ? 1 : 0);

/**
 * Test de non-régression : un nom de ville ne doit pas décider d'une catégorie.
 *
 *   npm run test:toponymes
 *
 * Écrit en Phase 0 comme reproduction du défaut, rendu vert en Phase 2.
 *
 * Il vise `detectCategory()` — le chemin réellement emprunté par la
 * publication — et non `AdClassifier` directement : la neutralisation des
 * toponymes est une étape du pipeline, pas une propriété de la primitive de
 * scoring, qui ignore légitimement ce qu'est une ville.
 *
 * Le symptôme rapporté — « Appartement Cannes » classé en véhicule utilitaire —
 * n'est pas reproductible tel quel : « appartement » est un mot-clé immobilier
 * fort et gagne. Le mécanisme, lui, est bien présent et se déclenche dès que le
 * titre n'a pas de nom-tête franc : le nom de ville est alors le seul terme
 * scoré, via une correspondance approximative (« Lyon » → « Leon », modèle
 * Seat ; « Fort-de-France » → « Ford »).
 */

import { detectCategory } from "../lib/autoCategory";
import { FRENCH_CITIES } from "../lib/cities";

let failures = 0;

// ── 1. Une ville seule ne doit jamais produire de catégorie ────────────
console.log("── Villes seules ──");
const leaking: { city: string; category: string; subcategory: string; via: string }[] = [];
for (const city of FRENCH_CITIES) {
  const r = detectCategory(city.name);
  if (r) {
    leaking.push({
      city: city.name,
      category: r.categoryId,
      subcategory: r.subcategory,
      via: `confiance ${r.confidence}`,
    });
  }
}
if (leaking.length > 0) {
  failures++;
  console.log(`\x1b[31m✗\x1b[0m ${leaking.length}/${FRENCH_CITIES.length} villes produisent une catégorie à elles seules :`);
  for (const l of leaking) {
    console.log(`    « ${l.city} » → ${l.category}/${l.subcategory}  (via ${l.via})`);
  }
} else {
  console.log(`\x1b[32m✓\x1b[0m aucune des ${FRENCH_CITIES.length} villes ne décide seule d'une catégorie`);
}

// ── 2. Ville + verbe faible : le verbe ne suffit pas, la ville ne doit pas
//      combler le vide. Attendu : aucune catégorie, donc une question posée.
console.log("\n── Ville + nom-tête absent ──");
const AMBIGUOUS = ["Loue Nice", "Vends Grasse", "Bien Nice", "Urgent Lyon", "Dispo Metz"];
for (const title of AMBIGUOUS) {
  const r = detectCategory(title);
  if (r) {
    failures++;
    console.log(`\x1b[31m✗\x1b[0m « ${title} » → ${r.categoryId}/${r.subcategory} (confiance ${r.confidence})`);
  } else {
    console.log(`\x1b[32m✓\x1b[0m « ${title} » → aucune catégorie, l'utilisateur sera interrogé`);
  }
}

// ── 3. Non-régression : avec un nom-tête, la classification reste juste ──
console.log("\n── Titres avec nom-tête (doivent rester corrects) ──");
const EXPECTED: [string, string][] = [
  ["Appartement Cannes", "immobilier"],
  ["Appartement Cannes 3 pièces", "immobilier"],
  ["Studio Nice", "immobilier"],
  ["Maison Bordeaux", "immobilier"],
  ["Villa Antibes", "immobilier"],
  ["Peugeot 208 Lyon", "vehicules"],
  ["Canapé cuir Lille très bon état", "maison"],
];
for (const [title, expected] of EXPECTED) {
  const r = detectCategory(title);
  if (r?.categoryId !== expected) {
    failures++;
    console.log(`\x1b[31m✗\x1b[0m « ${title} » → ${r?.categoryId ?? "aucune"}, attendu ${expected}`);
  } else {
    console.log(`\x1b[32m✓\x1b[0m « ${title} » → ${r.categoryId}/${r.subcategory}`);
  }
}

console.log(
  failures === 0 ? "\nToutes les assertions passent." : `\n${failures} assertion(s) en échec.`,
);
process.exit(failures > 0 ? 1 : 0);

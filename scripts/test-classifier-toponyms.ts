/**
 * Une ville ne doit jamais décider d'une catégorie.
 *
 * Régression historique : 24 des 154 villes du référentiel décidaient seules
 * d'une rubrique par simple ressemblance — « Lyon » → Seat Leon,
 * « Fort-de-France » → Ford, « Nice » → Nike. Deux d'entre elles sortaient en
 * Véhicules, ce qui produisait le bug « ville → utilitaire » remonté par les
 * utilisateurs.
 *
 * Le moteur actuel n'a pas de correspondance approximative : un toponyme ne
 * ressemble donc plus à une marque. Ce test verrouille la propriété.
 */
import { classifyTitle } from "../lib/category/engine";
import { FRENCH_CITIES } from "../lib/cities";

const cities = FRENCH_CITIES.map((c) => c.name);
const coupables: string[] = [];

for (const city of cities) {
  const r = classifyTitle(city);
  if (r.categoryId) coupables.push(`${city} → ${r.categoryId} / ${r.subcategory} (${r.confidence})`);
}

console.log(`villes testées : ${cities.length}`);
console.log(`villes produisant une catégorie : ${coupables.length}`);
coupables.slice(0, 15).forEach((c) => console.log("  ✗ " + c));

// Une ville accompagnée d'un vrai objet doit, elle, rester classée.
for (const t of ["Canapé cuir Lyon", "iPhone 15 Paris", "Peugeot 208 Nice"]) {
  const r = classifyTitle(t);
  console.log(`  ${r.categoryId ? "ok" : "✗ "} ${t} → ${r.categoryId ?? "aucune"} / ${r.subcategory ?? "—"}`);
}

process.exit(coupables.length === 0 ? 0 : 1);

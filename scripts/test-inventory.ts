/**
 * Règles de stock et traduction du choix d'activité.
 *
 * Les fonctions testées ici sont pures : ni base, ni réseau. Ce qui est vérifié,
 * ce sont les décisions — quand un produit est épuisé, quand une annonce bascule,
 * et ce qu'un professionnel obtient selon ce qu'il déclare vendre.
 *
 *     npx tsx scripts/test-inventory.ts
 */

import { stockOf } from "../lib/pro/inventory";
import {
  capabilitiesForChoice,
  choiceFromCapabilities,
} from "../lib/pro/business-model";
import { presetFor, capabilitiesOf } from "../lib/pro/capabilities";

let ok = 0, ko = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) { ok++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`); }
  else { ko++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); }
}

const base = { reserved: 0, unlimited: false, lowStockAt: null as number | null };

console.log("\nÉTAT DU STOCK");
{
  const s = stockOf({ ...base, quantity: 12 });
  check("12 en magasin, rien réservé", s.available === 12 && !s.outOfStock, `dispo ${s.available}`);
}
{
  // Douze pièces dont onze engagées, ce n'est pas douze disponibles.
  const s = stockOf({ ...base, quantity: 12, reserved: 11 });
  check("le réservé ne compte pas comme disponible", s.available === 1, `dispo ${s.available}`);
}
{
  const s = stockOf({ ...base, quantity: 0 });
  check("zéro en magasin = épuisé", s.outOfStock, `dispo ${s.available}`);
}
{
  const s = stockOf({ ...base, quantity: 3, reserved: 3 });
  check("tout réservé = épuisé", s.outOfStock, `dispo ${s.available}`);
}
{
  const s = stockOf({ ...base, quantity: 2, lowStockAt: 3 });
  check("sous le seuil = alerte, pas rupture", s.low && !s.outOfStock, `dispo ${s.available}`);
}
{
  const s = stockOf({ ...base, quantity: 0, lowStockAt: 3 });
  check("épuisé n'est pas « stock faible »", s.outOfStock && !s.low);
}
{
  const s = stockOf({ ...base, quantity: null, unlimited: true });
  check("illimité : jamais épuisé", !s.outOfStock && s.available === null);
}

console.log("\nVARIANTES");
{
  // La somme des variantes fait foi : tenir les deux les ferait diverger.
  const s = stockOf({
    ...base, quantity: 999,
    variants: [
      { quantity: 5, reserved: 0, isActive: true },
      { quantity: 7, reserved: 2, isActive: true },
    ],
  });
  check("le total vient des variantes, pas du produit", s.onHand === 12 && s.available === 10,
    `stock ${s.onHand}, dispo ${s.available}`);
}
{
  const s = stockOf({
    ...base, quantity: null,
    variants: [
      { quantity: 4, reserved: 0, isActive: false },
      { quantity: 0, reserved: 0, isActive: true },
    ],
  });
  check("une variante désactivée ne compte pas", s.outOfStock, `dispo ${s.available}`);
}

console.log("\nCHOIX D'ACTIVITÉ → CAPACITÉS");
{
  const c = capabilitiesForChoice("services");
  check("services : réservation oui, stock non",
    c.includes("bookings") && !c.includes("inventory"), c.join(", "));
}
{
  const c = capabilitiesForChoice("products");
  check("produits : stock oui, réservation non",
    c.includes("inventory") && !c.includes("bookings"), c.join(", "));
}
{
  const c = capabilitiesForChoice("both");
  check("les deux : stock et réservation",
    c.includes("inventory") && c.includes("bookings"), c.join(", "));
}

console.log("\nLECTURE INVERSE — AUCUN COMPTE « INDÉFINI »");
check("un salon existant se relit comme « services »",
  choiceFromCapabilities(presetFor("beaute")) === "services",
  presetFor("beaute").join(", "));
check("un garage existant se relit comme « produits »",
  choiceFromCapabilities(presetFor("automobile")) === "products",
  presetFor("automobile").join(", "));
check("un paysagiste existant se relit comme « les deux »",
  choiceFromCapabilities(presetFor("jardin")) === "both",
  presetFor("jardin").join(", "));
check("un métier inconnu ne casse rien",
  choiceFromCapabilities(presetFor("métier-qui-nexiste-pas")) === "services");

console.log("\nCOMPATIBILITÉ DES COMPTES EXISTANTS");
check("capacités jamais réglées → preset du métier",
  capabilitiesOf({ activityType: "beaute", capabilities: "[]" }).includes("bookings"));
check("capacités réglées → choix du pro respecté",
  !capabilitiesOf({ activityType: "beaute", capabilities: '["offerings"]' }).includes("bookings"));
check("aucun métier déclaré → vitrine seule, rien d'imposé",
  capabilitiesOf({ activityType: null, capabilities: "[]" }).join() === "offerings");

console.log(`\n${ok} réussis, ${ko} échoués\n`);
if (ko > 0) process.exitCode = 1;

/**
 * Vérifie qui déclenche l'analyse de plaques, et qui ne la déclenche pas.
 *
 * Deux erreurs possibles, de gravité très différente : analyser pour rien coûte
 * quelques centimes, ne pas analyser publie une plaque qu'on ne peut plus
 * reprendre. Les cas « prudence » ci-dessous sont donc voulus, pas subis.
 *
 *     npx tsx scripts/test-plate-policy.ts
 */

import { shouldDetectPlates } from "../lib/plate-policy.server";
import { platePolicyFromCategory } from "../lib/plate-policy";

let ok = 0, ko = 0;

function check(label: string, got: boolean, want: boolean, reason: string) {
  if (got === want) { ok++; console.log(`  ✓ ${label} — ${reason}`); }
  else { ko++; console.log(`  ✗ ${label} — attendu ${want}, obtenu ${got} (${reason})`); }
}

function t(label: string, input: Parameters<typeof shouldDetectPlates>[0], want: boolean) {
  const r = shouldDetectPlates(input);
  check(label, r.shouldDetect, want, r.reason);
}

console.log("\nRUBRIQUE CHOISIE");
t("Véhicules", { categoryId: "vehicules" }, true);
t("Véhicules (libellé)", { categoryId: "Véhicules" }, true);
t("Matériel professionnel", { categoryId: "materiel-pro" }, true);
t("Bien-être", { categoryId: "bien-etre" }, false);
t("Maison", { categoryId: "maison" }, false);
t("Mode", { categoryId: "mode" }, false);
t("Multimédia", { categoryId: "multimedia" }, false);
t("Location de vacances (garage/parking dans le cadre)", { categoryId: "immobilier", subcategory: "Locations de vacances" }, true);
t("Immobilier hors vacances", { categoryId: "immobilier", subcategory: "Ventes immobilières" }, false);

console.log("\nSANS RUBRIQUE — DÉDUCTION PAR LE TITRE");
t("BMW Série 3", { title: "BMW Série 3 320d 2018" }, true);
t("Yamaha MT-07", { title: "Yamaha MT-07 35kW" }, true);
t("Massage bien-être", { title: "Massage relaxant bien-être à domicile" }, false);
t("Canapé", { title: "Canapé d'angle convertible tissu gris" }, false);

console.log("\nPRUDENCE — LE DOUTE PENCHE VERS L'ANALYSE");
t("titre vide", { title: "" }, true);
t("titre trop court", { title: "ab" }, true);
t("aucun contexte", {}, true);

console.log("\nDÉCISION CÔTÉ NAVIGATEUR (sans moteur de catégorisation)");
check("Véhicules → detect", platePolicyFromCategory("vehicules").verdict === "detect", true, "rubrique véhicules");
check("Bien-être → skip", platePolicyFromCategory("bien-etre").verdict === "skip", true, "rubrique sans véhicule");
check("rien → unknown", platePolicyFromCategory(null).verdict === "unknown", true, "le serveur tranchera");

console.log(`\n${ok} réussis, ${ko} échoués\n`);
if (ko > 0) process.exitCode = 1;

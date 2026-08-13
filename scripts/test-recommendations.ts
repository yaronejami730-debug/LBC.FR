/**
 * Scénarios de non-régression du moteur de recommandation.
 *
 * Aucune base de données : le scoring est une fonction pure, et c'est
 * précisément pour pouvoir le vérifier ainsi qu'il a été écrit comme ça. Ce qui
 * est testé ici, ce sont les décisions — qui reçoit quoi, et surtout qui ne
 * reçoit rien — pas la plomberie d'envoi.
 *
 *     npx tsx scripts/test-recommendations.ts
 */

import { resolveLocation } from "../lib/geo/communes";
import { distanceKm } from "../lib/geo/distance";
import { bestZoneMatch, type ScoredZone } from "../lib/recommendations/score";
import { interestScore } from "../lib/recommendations/category-interest";
import { excerpt, summarizePlaces } from "../lib/emails/listing-recommendations";
import { RECO_CONFIG } from "../lib/recommendations/config";

const NOW = new Date("2026-08-12T10:00:00Z");
const HIER = new Date(NOW.getTime() - 20 * 3_600_000);

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Fabrique une annonce localisée à partir d'un nom de commune. */
function listing(location: string, createdAt = HIER) {
  const point = resolveLocation(location);
  if (!point) throw new Error(`localisation de test irrésoluble : ${location}`);
  return {
    id: `listing-${location}`,
    createdAt,
    lat: point.lat,
    lng: point.lng,
    geoPrecision: point.precision,
  };
}

/** Fabrique une zone utilisateur. */
function zone(
  location: string,
  source: ScoredZone["source"],
  confidence: number,
  isPrimary = true,
): ScoredZone {
  const point = resolveLocation(location);
  if (!point) throw new Error(`zone de test irrésoluble : ${location}`);
  return {
    zoneKey: point.insee || `dept:${point.department}`,
    lat: point.lat,
    lng: point.lng,
    precision: point.precision,
    source,
    certainty: source === "LISTING_PUBLISHED" || source === "PROFILE_ADDRESS" ? "CERTAIN" : "ESTIMATED",
    confidence,
    isPrimary,
  };
}

function score(l: ReturnType<typeof listing>, zones: ScoredZone[], categoryInterest: number) {
  return bestZoneMatch({ listing: l, zones, categoryInterest, now: NOW });
}

const retained = (r: ReturnType<typeof score>) =>
  !!r && !r.rejectedFor && r.score >= RECO_CONFIG.minScore;

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nGÉOCODAGE");
// ═══════════════════════════════════════════════════════════════════════════

check("Paris 16e tombe sur l'arrondissement, pas sur Paris entier",
  resolveLocation("Paris 16e")?.insee === "75116");
check("un code postal seul suffit", resolveLocation("89100")?.city === "Sens");
check("une adresse de rue ne masque pas la commune",
  resolveLocation("12 rue des Lilas, 75011 Paris")?.city === "Paris");
check("un homonyme sans indice est refusé plutôt que deviné",
  resolveLocation("Saint-Denis") === null);
check("le même homonyme avec département est résolu",
  resolveLocation("Saint-Denis (93)")?.insee === "93066");
check("une saisie non reconnue ne produit pas de point",
  resolveLocation("quelque part") === null);
check("un libellé de quartier livre quand même sa commune",
  resolveLocation("Rennes Nord, Ille-et-Vilaine (35), France")?.city === "Rennes");
check("un lieu-dit qui n'est pas une commune n'est pas promu en commune",
  resolveLocation("La Croix Verte, Val-d'Oise (95), France")?.precision === "DEPARTMENT");
check("une adresse commerciale complète retombe sur la bonne commune",
  resolveLocation("6 Boulevard d'Émeraude, 35760 Montgermont, Ille-et-Vilaine (35)")?.city ===
    "Montgermont");

const paris = resolveLocation("Paris 16e")!;
const neuilly = resolveLocation("Neuilly-sur-Seine")!;
const lyon = resolveLocation("Lyon")!;
check("Paris 16e ↔ Neuilly sous 20 km", distanceKm(paris, neuilly) < 20,
  `${distanceKm(paris, neuilly).toFixed(1)} km`);
check("Paris ↔ Lyon très au-delà", distanceKm(paris, lyon) > 300,
  `${distanceKm(paris, lyon).toFixed(0)} km`);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nSCÉNARIOS DE RECOMMANDATION");
// ═══════════════════════════════════════════════════════════════════════════

// A — même ville, même catégorie, historique de publication.
{
  const r = score(listing("Paris 16e"), [zone("Paris 16e", "LISTING_PUBLISHED", 90)], 80);
  check("A. Paris → annonce Paris, catégorie suivie : recommandé", retained(r),
    `score ${r?.score}`);
}

// B — l'autre bout du pays.
{
  const r = score(listing("Lyon"), [zone("Paris 16e", "LISTING_PUBLISHED", 90)], 80);
  check("B. Paris → annonce Lyon : écarté", !retained(r), r?.rejectedFor);
}

// C — commune limitrophe.
{
  const r = score(listing("Paris 16e"), [zone("Neuilly-sur-Seine", "LISTING_PUBLISHED", 85)], 70);
  check("C. Neuilly → annonce Paris : recommandé", retained(r), `score ${r?.score}`);
}

// D — le piège : la proximité seule.
{
  const r = score(listing("Paris 16e"), [zone("Paris 16e", "LISTING_PUBLISHED", 95)], 5);
  check("D. voisin sans intérêt pour la catégorie : écarté", !retained(r), r?.rejectedFor);
}

// E — plusieurs publications dans la même zone.
{
  const r = score(listing("Sens"), [zone("Sens", "LISTING_PUBLISHED", 98)], 90);
  check("E. publications répétées à Sens → annonce Sens : score très élevé",
    retained(r) && (r?.score ?? 0) >= 85, `score ${r?.score}`);
}

// F — localisation seulement estimée.
{
  const certain = score(listing("Paris 16e"), [zone("Paris 16e", "LISTING_PUBLISHED", 90)], 60);
  const estime = score(listing("Paris 16e"), [zone("Paris 16e", "LISTING_VIEWED", 45)], 45);
  check("F. consultations seules : recommandation possible", retained(estime),
    `score ${estime?.score}`);
  check("F. mais toujours moins bien notée qu'une localisation certaine",
    (estime?.score ?? 0) < (certain?.score ?? 0),
    `${estime?.score} < ${certain?.score}`);
  check("F. et marquée comme estimée", estime?.certainty === "ESTIMATED");
}

// G — aucune localisation connue.
{
  const r = score(listing("Paris 16e"), [], 90);
  check("G. compte sans zone connue : aucune recommandation", r === null);
}

// H — zone trop grossière pour un rayon de 20 km.
{
  const departement = resolveLocation("(89)")!;
  const r = bestZoneMatch({
    listing: listing("Sens"),
    zones: [{
      zoneKey: "dept:89",
      lat: departement.lat,
      lng: departement.lng,
      precision: departement.precision,
      source: "LISTING_VIEWED",
      certainty: "ESTIMATED",
      confidence: 60,
      isPrimary: true,
    }],
    categoryInterest: 80,
    now: NOW,
  });
  check("H. centroïde départemental : jamais utilisé pour décider à 20 km",
    !retained(r), r?.rejectedFor);
}

// I — la limite exacte du rayon.
{
  const dedans = score(listing("Versailles"), [zone("Paris 16e", "LISTING_PUBLISHED", 90)], 80);
  const dehors = score(listing("Melun"), [zone("Paris 16e", "LISTING_PUBLISHED", 90)], 80);
  check("I. Versailles depuis Paris 16e : dans le rayon", retained(dedans),
    `${dedans?.distanceKm.toFixed(1)} km`);
  check("I. Melun depuis Paris 16e : hors rayon", !retained(dehors),
    `${dehors?.distanceKm.toFixed(1)} km`);
}

// J — plusieurs zones : la meilleure gagne, elles ne s'additionnent pas.
{
  const zones = [
    zone("Paris 16e", "LISTING_PUBLISHED", 90, true),
    zone("Sens", "LISTING_VIEWED", 40, false),
  ];
  const r = score(listing("Sens"), zones, 70);
  check("J. compte multi-zones : l'annonce de Sens passe par la zone de Sens",
    r?.zoneKey === resolveLocation("Sens")!.insee, `zone ${r?.zoneKey}`);
  check("J. et son score reste celui d'une zone estimée",
    (r?.score ?? 0) < 85, `score ${r?.score}`);
}

// K — décote temporelle de l'intérêt.
{
  const base = { publishedCount: 1, favoriteCount: 0, viewCount: 0, searchCount: 0,
    emailClickCount: 0, ignoredEmailCount: 0 };
  const frais = interestScore({ ...base, lastActivityAt: HIER }, NOW);
  const vieux = interestScore(
    { ...base, lastActivityAt: new Date(NOW.getTime() - 400 * 86_400_000) }, NOW);
  check("K. un intérêt ancien pèse moins qu'un intérêt récent", vieux < frais,
    `${vieux} < ${frais}`);
  check("K. sans jamais tomber à zéro", vieux > 0, `${vieux}`);
}

// L — signal négatif.
{
  const commun = { publishedCount: 0, favoriteCount: 0, viewCount: 8, searchCount: 0,
    emailClickCount: 0, lastActivityAt: HIER };
  const neutre = interestScore({ ...commun, ignoredEmailCount: 0 }, NOW);
  const ignore = interestScore({ ...commun, ignoredEmailCount: 3 }, NOW);
  check("L. des emails systématiquement ignorés font chuter l'intérêt",
    ignore < neutre, `${ignore} < ${neutre}`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nRENDU DE L'EMAIL");
// ═══════════════════════════════════════════════════════════════════════════

check("l'extrait coupe au mot, pas au caractère",
  !excerpt("Maison familiale de 95 m² avec jardin, proche des commerces et des écoles du centre", 40)
    .replace("…", "").endsWith(" ") &&
  excerpt("Maison familiale de 95 m² avec jardin, proche des commerces et des écoles", 40).endsWith("…"));
check("l'extrait retire le HTML",
  !excerpt("<p>Maison <strong>familiale</strong></p>").includes("<"));
check("un texte court n'est pas tronqué",
  excerpt("Maison avec jardin") === "Maison avec jardin");
check("le résumé des communes reste lisible au-delà de deux",
  summarizePlaces(["Paris", "Neuilly-sur-Seine", "Boulogne-Billancourt", "Levallois-Perret"]) ===
    "Paris, Neuilly-sur-Seine et 2 autres communes");

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed} réussis, ${failed} échoués\n`);
if (failed > 0) process.exitCode = 1;

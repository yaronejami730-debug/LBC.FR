/**
 * Synonymes FR pour le moteur de recherche OpenSearch.
 *
 * Format Solr : chaque ligne = un groupe de termes équivalents.
 * Injecté dans le filtre `synonym_graph` de l'analyseur de recherche
 * (lib/opensearch-index.ts) — appliqué au moment de la requête, donc
 * modifiable sans réindexer.
 *
 * Les termes passent par l'analyseur (minuscule + asciifolding) :
 * écrire en minuscules, sans accent, sans tiret de préférence.
 */

export const FR_SYNONYMS: string[] = [
  // ── Multimédia ────────────────────────────────────────────
  "telephone, smartphone, portable, mobile, gsm",
  "ordinateur, ordi, pc, laptop, notebook",
  "television, televiseur, tv, ecran plat",
  "console, console de jeux, console de jeu",
  "casque, ecouteurs, casque audio",
  "appareil photo, camera, apn",
  "disque dur, dd, hdd, ssd, stockage",

  // ── Véhicules ─────────────────────────────────────────────
  "voiture, auto, automobile, bagnole, caisse, vehicule",
  "moto, motocyclette, deux roues, scooter",
  "velo, bicyclette, vtt, vtc",
  "pare chocs, parechoc, bouclier",
  "retroviseur, retro, miroir",
  "boite de vitesses, boite, transmission",
  "controle technique, ct",
  "utilitaire, fourgon, camionnette",

  // ── Immobilier ────────────────────────────────────────────
  "appartement, appart, apt, studio, logement",
  "maison, villa, pavillon, demeure",
  "location, louer, a louer, bail",
  "vente, a vendre, achat",
  "rez de chaussee, rdc",
  "salle de bain, salle d eau, sdb",

  // ── Maison / électroménager ──────────────────────────────
  "refrigerateur, frigo, frigidaire",
  "lave linge, machine a laver, laveuse",
  "seche linge, sechoir",
  "lave vaisselle",
  "micro ondes, four micro ondes",
  "canape, sofa, divan, banquette",
  "armoire, penderie, dressing, placard",
  "table basse, table de salon",

  // ── Mode / divers ────────────────────────────────────────
  "vetement, habit, fringue",
  "chaussure, basket, soulier",
  "poussette, landau, buggy",
  "negociable, a debattre, prix a debattre",
];

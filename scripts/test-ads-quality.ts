/**
 * Vérifications du score qualité et des règles de facturation.
 *
 * Le score décide du rang, donc de qui est servi, donc de ce qui est facturé.
 * Deux propriétés comptent plus que la valeur exacte : une campagne neuve n'est
 * ni avantagée ni punie, et un petit échantillon ne doit pas suffire à faire
 * bouger le score.
 *
 *     npx tsx scripts/test-ads-quality.ts
 */
import {
  computeQualityScore,
  MAX_QUALITY_SCORE,
  MIN_QUALITY_SCORE,
  normalizedQuality,
  NEUTRAL_QUALITY_SCORE,
} from "../lib/ads/quality-score";
import { floorsOf, legacyBidCents, modelForObjective, DEFAULT_FLOORS } from "../lib/ads/billing";
import { check, equal, report, section } from "./test-helpers";

const BASELINE = 0.004;

const complet = {
  baselineCtr: BASELINE,
  creativeComplete: true,
  destinationValid: true,
};

section("Une campagne sans historique");
{
  const neuf = computeQualityScore({
    viewableImpressions: 0,
    clicks: 0,
    loads: 0,
    invalidEvents: 0,
    conversions: 0,
    ...complet,
  });
  check(
    "un créatif neuf part autour du neutre",
    Math.abs(neuf.score - NEUTRAL_QUALITY_SCORE) <= 15,
    `score obtenu : ${neuf.score}`,
  );
  check("le score reste dans ses bornes", neuf.score >= MIN_QUALITY_SCORE && neuf.score <= MAX_QUALITY_SCORE);
}

section("Un petit échantillon ne fait pas un score");
{
  // Dix impressions, un clic : un taux de clic de 10 %, vingt-cinq fois la
  // moyenne. Le lissage doit refuser d'y croire.
  const chanceux = computeQualityScore({
    viewableImpressions: 10,
    clicks: 1,
    loads: 12,
    invalidEvents: 0,
    conversions: 0,
    ...complet,
  });
  const solide = computeQualityScore({
    viewableImpressions: 5000,
    clicks: 500,
    loads: 6000,
    invalidEvents: 0,
    conversions: 0,
    ...complet,
  });

  check(
    "un coup de chance sur dix impressions ne fait pas un bon score",
    chanceux.score < solide.score,
    `chanceux ${chanceux.score} vs solide ${solide.score}`,
  );
  check("un bon taux de clic tenu sur 5 000 impressions, si", solide.score >= 85);
}

section("Ce qui fait monter et descendre");
{
  const moyen = computeQualityScore({
    viewableImpressions: 5000,
    clicks: 20,
    loads: 6000,
    invalidEvents: 0,
    conversions: 0,
    ...complet,
  });
  const meilleurCtr = computeQualityScore({
    viewableImpressions: 5000,
    clicks: 60,
    loads: 6000,
    invalidEvents: 0,
    conversions: 0,
    ...complet,
  });
  check("un meilleur taux de clic élève le score", meilleurCtr.score > moyen.score);

  const peuVisible = computeQualityScore({
    viewableImpressions: 1000,
    clicks: 4,
    loads: 10_000,
    invalidEvents: 0,
    conversions: 0,
    ...complet,
  });
  const bienVisible = computeQualityScore({
    viewableImpressions: 1000,
    clicks: 4,
    loads: 1200,
    invalidEvents: 0,
    conversions: 0,
    ...complet,
  });
  check(
    "des affichages qui n'atteignent jamais l'écran font baisser le score",
    peuVisible.score < bienVisible.score,
  );

  // Témoin au même volume et au même taux de clic : comparer à une campagne
  // dix fois plus servie mesurerait autre chose que ce qu'on veut vérifier.
  const temoin = computeQualityScore({
    viewableImpressions: 1000,
    clicks: 20,
    loads: 1200,
    invalidEvents: 0,
    conversions: 0,
    ...complet,
  });

  const sale = computeQualityScore({
    viewableImpressions: 1000,
    clicks: 20,
    loads: 1200,
    invalidEvents: 400,
    conversions: 0,
    ...complet,
  });
  check("un trafic largement écarté fait chuter le score", sale.score < temoin.score);

  const bacle = computeQualityScore({
    viewableImpressions: 1000,
    clicks: 20,
    loads: 1200,
    invalidEvents: 0,
    conversions: 0,
    baselineCtr: BASELINE,
    creativeComplete: false,
    destinationValid: false,
  });
  check("un créatif incomplet et une destination cassée pèsent", bacle.score < temoin.score);
}

section("Normalisation");
{
  equal("100 sur 100 vaut 1", normalizedQuality(100), 1);
  check("un score aberrant est ramené dans les bornes", normalizedQuality(-40) === MIN_QUALITY_SCORE / 100);
  check("et par le haut aussi", normalizedQuality(9999) === 1);
}

section("Modèle de facturation d'un objectif");
{
  equal("la visibilité se paie à l'impression visible", modelForObjective("VISIBILITE"), "CPM");
  equal("les visites se paient au clic", modelForObjective("VISITES"), "CPC");
  equal("les contacts aussi", modelForObjective("CONTACTS"), "CPC");
  equal("les réservations aussi", modelForObjective("RESERVATIONS"), "CPC");
  equal("la promotion d'une annonce aussi", modelForObjective("ANNONCE"), "CPC");
}

section("Planchers et campagnes d'avant les enchères");
{
  const sansLigne = floorsOf(undefined);
  equal("sans ligne de grille, le plancher au clic est celui par défaut", sansLigne.cpcCents, DEFAULT_FLOORS.cpcCents);
  equal("idem pour mille impressions", sansLigne.cpmCents, DEFAULT_FLOORS.cpmCents);

  const zero = floorsOf({
    placement: "HOME_TOP",
    model: "CPC",
    priceCents: 25,
    floorCpcCents: 0,
    floorCpmCents: 0,
    isOpen: true,
  });
  check(
    "un plancher à zéro ne brade pas l'inventaire",
    zero.cpcCents === DEFAULT_FLOORS.cpcCents && zero.cpmCents === DEFAULT_FLOORS.cpmCents,
  );

  const grille = {
    placement: "HOME_TOP",
    model: "CPC",
    priceCents: 25,
    floorCpcCents: 15,
    floorCpmCents: 200,
    isOpen: true,
  };
  equal("une campagne d'avant les enchères enchérit au tarif vendu", legacyBidCents("CPC", grille), 25);
  check("et au moins au plancher dans l'autre modèle", legacyBidCents("CPM", grille) >= 200);
}

report("Score qualité et facturation");

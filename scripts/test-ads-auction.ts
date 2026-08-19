/**
 * Vérifications du moteur d'enchères.
 *
 * L'enchère décide qui est servi **et** ce qui sera facturé : c'est le seul
 * endroit du système où une erreur se traduit directement en euros pris à
 * quelqu'un. Elle est donc écrite comme une fonction pure, et vérifiée cas par
 * cas — sans base, sans réseau, sans horloge.
 *
 *     npx tsx scripts/test-ads-auction.ts
 */
import {
  adRankOf,
  billableCost,
  bidNeededFor,
  MIN_INCREMENT_CENTS,
  runAuction,
  type AuctionCandidate,
} from "../lib/ads/auction";
import { approx, check, equal, report, section } from "./test-helpers";

const FLOORS = { cpcCents: 15, cpmCents: 200 };
const BASELINE = 0.004;

function cpc(id: string, bid: number, quality: number, extra: Partial<AuctionCandidate> = {}): AuctionCandidate {
  return {
    campaignId: `camp-${id}`,
    adId: `ad-${id}`,
    maxBidCents: bid,
    qualityScore: quality,
    billingModel: "CPC",
    ...extra,
  };
}

section("Une seule campagne en lice");
{
  const result = runAuction([cpc("a", 100, 90)], FLOORS, { baselineCtr: BASELINE });
  check("une campagne seule gagne", result?.winner.adId === "ad-a");
  equal("elle paie le plancher, pas son plafond", result?.priceCents, FLOORS.cpcCents);
  equal("aucun second rang", result?.runnerUpRank, null);
}

section("Deux concurrents : le second prix");
{
  // Le cas du cahier des charges : A à 1 € avec 90 de qualité, B à 0,70 € avec
  // 80. A doit gagner, et payer juste ce qu'il faut pour dépasser B.
  const a = cpc("a", 100, 90);
  const b = cpc("b", 70, 80);
  const result = runAuction([a, b], FLOORS, { baselineCtr: BASELINE })!;

  equal("la meilleure combinaison enchère × qualité gagne", result.winner.adId, "ad-a");
  check("le gagnant paie moins que son plafond", result.priceCents < a.maxBidCents);

  // Le prix doit être l'enchère minimale qui égale le rang du suivant, plus un
  // centime : c'est la définition, elle doit tenir au centime près.
  const needed = Math.ceil(bidNeededFor(a, adRankOf(b, b.maxBidCents, BASELINE), BASELINE));
  approx("le prix vaut le rang du suivant, ramené à la qualité du gagnant", result.priceCents, needed + MIN_INCREMENT_CENTS, 0);

  check(
    "le rang du gagnant dépasse celui du suivant",
    result.adRank > (result.runnerUpRank ?? 0),
  );
}

section("La qualité peut battre le montant");
{
  // Enchère plus basse, bien meilleure qualité : le moins-disant doit pouvoir
  // gagner, sinon l'inventaire part au plus offrant quelle que soit la
  // pertinence — et le visiteur paie la note.
  const riche = cpc("riche", 100, 30);
  const bon = cpc("bon", 60, 100);
  const result = runAuction([riche, bon], FLOORS, { baselineCtr: BASELINE })!;
  equal("le meilleur créatif l'emporte sur le plus gros plafond", result.winner.adId, "ad-bon");
}

section("Concurrence croissante : le prix monte");
{
  const gagnant = cpc("a", 100, 80);
  const prixSeul = runAuction([gagnant], FLOORS, { baselineCtr: BASELINE })!.priceCents;
  const prixDeux = runAuction([gagnant, cpc("b", 40, 80)], FLOORS, { baselineCtr: BASELINE })!.priceCents;
  const prixFort = runAuction([gagnant, cpc("c", 95, 80)], FLOORS, { baselineCtr: BASELINE })!.priceCents;

  check("sans concurrence, le prix est au plancher", prixSeul === FLOORS.cpcCents);
  check("une concurrence modérée fait monter le prix", prixDeux > prixSeul);
  check("une concurrence forte le fait monter davantage", prixFort > prixDeux);
  check("le plafond n'est jamais dépassé", prixFort <= gagnant.maxBidCents);
}

section("Le plafond est un engagement");
{
  // Un concurrent au rang supérieur devrait exiger plus que le plafond : le
  // gagnant change, et personne ne paie au-delà de ce qu'il a consenti.
  const petit = cpc("petit", 20, 70);
  const gros = cpc("gros", 300, 70);
  const result = runAuction([petit, gros], FLOORS, { baselineCtr: BASELINE })!;
  equal("le mieux classé gagne", result.winner.adId, "ad-gros");
  check("le prix reste sous le plafond du gagnant", result.priceCents <= gros.maxBidCents);

  // Et si le gagnant a un plafond serré, le prix est écrêté à ce plafond.
  const serre = cpc("serre", 22, 95);
  const contre = cpc("contre", 100, 60);
  const result2 = runAuction([serre, contre], FLOORS, { baselineCtr: BASELINE })!;
  check(
    "le prix ne dépasse jamais le plafond, même quand le suivant est cher",
    result2.priceCents <= result2.winner.maxBidCents,
  );
}

section("Plancher de l'emplacement");
{
  const sousPlancher = cpc("bas", 10, 100);
  const result = runAuction([sousPlancher], FLOORS, { baselineCtr: BASELINE });
  equal("une enchère sous le plancher n'entre pas dans l'enchère", result, null);

  const mixte = runAuction([sousPlancher, cpc("ok", 50, 50)], FLOORS, { baselineCtr: BASELINE })!;
  equal("elle ne tire pas non plus le prix des autres", mixte.entries, 1);
  equal("faute de concurrent réel, le prix retombe au plancher", mixte.priceCents, FLOORS.cpcCents);
}

section("Clic et impression visible ne se comparent pas dans la même unité");
{
  // Une campagne au clic à 50 centimes et une campagne à la visibilité à 3 €
  // pour mille : c'est le revenu attendu pour mille affichages qui départage.
  const clic = cpc("clic", 50, 70);
  const visibilite: AuctionCandidate = {
    campaignId: "camp-vis",
    adId: "ad-vis",
    maxBidCents: 300,
    qualityScore: 70,
    billingModel: "CPM",
  };

  const rangClic = adRankOf(clic, clic.maxBidCents, BASELINE);
  const rangVis = adRankOf(visibilite, visibilite.maxBidCents, BASELINE);
  check("les deux rangs sont comparables en eCPM", rangClic > 0 && rangVis > 0);

  const result = runAuction([clic, visibilite], FLOORS, { baselineCtr: BASELINE })!;
  equal(
    "le meilleur revenu attendu gagne, quel que soit le modèle",
    result.winner.adId,
    rangVis > rangClic ? "ad-vis" : "ad-clic",
  );
}

section("Ce que coûte chaque type d'événement");
{
  equal("en CPC, une impression visible ne coûte rien", billableCost("VIEWABLE_IMPRESSION", "CPC", 63), 0);
  equal("en CPC, le clic coûte le prix de l'enchère", billableCost("CLICK", "CPC", 63), 63);
  equal("en CPM, le clic ne coûte rien", billableCost("CLICK", "CPM", 3000), 0);
  equal("en CPM, mille impressions coûtent le prix", billableCost("VIEWABLE_IMPRESSION", "CPM", 3000), 3);
  equal("un chargement ne coûte jamais rien", billableCost("LOAD", "CPC", 63), 0);
  equal("un rendu non plus", billableCost("RENDER", "CPM", 3000), 0);
  equal("une conversion n'est pas facturée en soi", billableCost("CONVERSION", "CPC", 63), 0);
  equal("une impression visible facturable ne tombe jamais à zéro", billableCost("VIEWABLE_IMPRESSION", "CPM", 200), 1);
}

section("La pertinence module sans décider");
{
  const neutre = cpc("neutre", 60, 70);
  const cible = cpc("cible", 60, 70, { relevance: 1.4 });
  const result = runAuction([neutre, cible], FLOORS, { baselineCtr: BASELINE })!;
  equal("à enchère et qualité égales, la pertinence départage", result.winner.adId, "ad-cible");

  const grosBudget = cpc("gros", 200, 70);
  const bienCible = cpc("cible2", 30, 70, { relevance: 1.5 });
  const result2 = runAuction([grosBudget, bienCible], FLOORS, { baselineCtr: BASELINE })!;
  equal("mais elle ne renverse pas un écart d'enchère majeur", result2.winner.adId, "ad-gros");
}

report("Enchères");

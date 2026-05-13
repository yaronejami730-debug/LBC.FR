import type { BlogArticle } from "./types";
import { article as vendreVoiture } from "./posts/vendre-voiture-occasion";
import { article as eviterArnaques } from "./posts/eviter-arnaques-petites-annonces";
import { article as estimerLoyer } from "./posts/estimer-loyer-appartement";
import { article as sitesAnnonces } from "./posts/sites-petites-annonces-gratuits-france";
import { article as vendreVetements } from "./posts/vendre-vetements-occasion";
import { article as acheteurSmartphone } from "./posts/acheter-smartphone-occasion";
import { article as vendreMeubles } from "./posts/vendre-meubles-occasion";
import { article as acheterVoiture } from "./posts/acheter-voiture-occasion-particulier";
import { article as guideAcheteur } from "./posts/guide-acheteur-petites-annonces";
import { article as vendreAppartement } from "./posts/vendre-appartement-entre-particuliers";
import { article as vendreVoitureParticulier } from "./posts/vendre-voiture-entre-particuliers-sans-agence";
import { article as acheterAppartementParis } from "./posts/acheter-appartement-paris-particulier";
import { article as louerSansAgence } from "./posts/louer-appartement-sans-agence";
import { article as voitureMoins5000 } from "./posts/voiture-occasion-moins-5000-euros";
import { article as vendreObjetsRapidement } from "./posts/comment-vendre-objets-rapidement";
import { article as economieCirulaire } from "./posts/economie-circulaire-meubles-occasion";
import { article as estimerPrixObjet } from "./posts/estimer-prix-objet-occasion";
import { article as materielPro } from "./posts/materiel-professionnel-occasion";
import { article as viderMaison } from "./posts/vider-maison-faire-profit";
import { article as puericulture } from "./posts/puericulture-occasion";
import { article as domTom } from "./posts/marketplace-dom-tom";
import { article as annonceImmo } from "./posts/annonce-immobiliere-gratuite";
import { article as jobAppoint } from "./posts/trouver-job-appoint-local";
import { article as meilleureTrott2026 } from "./posts/meilleure-trottinette-electrique-2026";
import { article as dualtronVsKukirin } from "./posts/dualtron-vs-kukirin-comparatif";
import { article as reglementationTrott2026 } from "./posts/reglementation-trottinette-electrique-2026";
import { article as assuranceTrott2026 } from "./posts/assurance-trottinette-electrique-2026";
import { article as meilleureTrottParis } from "./posts/meilleure-trottinette-electrique-paris";
import { article as miniCooperOccasion } from "./posts/mini-cooper-occasion-fiable";
import { article as clioOccasionGen } from "./posts/renault-clio-occasion-quelle-generation";
import { article as peugeot208Occasion } from "./posts/peugeot-208-occasion-avis-fiabilite";
import { article as bmwSerie1Entretien } from "./posts/cout-entretien-bmw-serie-1";
import { article as meilleureCitadine2026 } from "./posts/meilleure-citadine-occasion-2026";
import { article as arnaquesVoiture } from "./posts/eviter-arnaques-voiture-occasion";
import { article as essaiVoitureChecklist } from "./posts/essai-voiture-occasion-checklist";
import { article as acheterMotoChecklist } from "./posts/acheter-moto-occasion-checklist";
import { article as coutEntretienMoto } from "./posts/cout-entretien-moto-annuel";
import { article as dossierLocationBeton } from "./posts/dossier-location-beton";
import { article as hondaCb500fAvis } from "./posts/honda-cb500f-occasion-avis";
import { article as louerParisBudget } from "./posts/louer-paris-budget-reel";
import { article as meilleureMotoDebutant } from "./posts/meilleure-moto-debutant-2026";
import { article as permisA2Motos } from "./posts/permis-a2-meilleures-motos";
import { article as yamahaMt07Avis } from "./posts/yamaha-mt07-occasion-avis";
import { article as estimerPrixVoiture } from "./posts/estimer-prix-voiture-occasion";
import { article as voitureSansCT } from "./posts/voiture-sans-controle-technique-2026";
import { article as combienTempsVendreVoiture } from "./posts/combien-de-temps-vendre-voiture";
import { article as ouInvestirImmo2026 } from "./posts/ou-investir-immobilier-locatif-2026";
import { article as trottinetteDebridee } from "./posts/trottinette-electrique-debridee-loi-2026";

const articles: BlogArticle[] = [
  vendreVoiture,
  eviterArnaques,
  estimerLoyer,
  sitesAnnonces,
  vendreVetements,
  acheteurSmartphone,
  vendreMeubles,
  acheterVoiture,
  guideAcheteur,
  vendreAppartement,
  vendreVoitureParticulier,
  acheterAppartementParis,
  louerSansAgence,
  voitureMoins5000,
  vendreObjetsRapidement,
  economieCirulaire,
  estimerPrixObjet,
  materielPro,
  viderMaison,
  puericulture,
  domTom,
  annonceImmo,
  jobAppoint,
  meilleureTrott2026,
  dualtronVsKukirin,
  reglementationTrott2026,
  assuranceTrott2026,
  meilleureTrottParis,
  miniCooperOccasion,
  clioOccasionGen,
  peugeot208Occasion,
  bmwSerie1Entretien,
  meilleureCitadine2026,
  arnaquesVoiture,
  essaiVoitureChecklist,
  acheterMotoChecklist,
  coutEntretienMoto,
  dossierLocationBeton,
  hondaCb500fAvis,
  louerParisBudget,
  meilleureMotoDebutant,
  permisA2Motos,
  yamahaMt07Avis,
  estimerPrixVoiture,
  voitureSansCT,
  combienTempsVendreVoiture,
  ouInvestirImmo2026,
  trottinetteDebridee,
].sort(
  (a, b) => (a.publishedAt < b.publishedAt ? 1 : -1),
);

export function getAllArticles(): BlogArticle[] {
  return articles;
}

export function getArticleBySlug(slug: string): BlogArticle | undefined {
  return articles.find((a) => a.slug === slug);
}

export function getRelatedArticles(slug: string, limit = 3): BlogArticle[] {
  const current = articles.find((a) => a.slug === slug);
  if (!current) return articles.slice(0, limit);
  return articles
    .filter((a) => a.slug !== slug)
    .sort((a, b) => {
      const aShared = a.keywords.filter((k) => current.keywords.includes(k)).length;
      const bShared = b.keywords.filter((k) => current.keywords.includes(k)).length;
      if (aShared !== bShared) return bShared - aShared;
      return a.publishedAt < b.publishedAt ? 1 : -1;
    })
    .slice(0, limit);
}

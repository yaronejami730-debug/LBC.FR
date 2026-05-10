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

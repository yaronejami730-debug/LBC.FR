import type { BlogArticle } from "./types";
import { article as vendreVoiture } from "./posts/vendre-voiture-occasion";
import { article as eviterArnaques } from "./posts/eviter-arnaques-petites-annonces";
import { article as estimerLoyer } from "./posts/estimer-loyer-appartement";

const articles: BlogArticle[] = [vendreVoiture, eviterArnaques, estimerLoyer].sort(
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

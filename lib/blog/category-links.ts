import { getAllArticles } from "./index";
import type { BlogArticle } from "./types";

const CATEGORY_KEYWORDS: Record<string, RegExp> = {
  vehicules: /voiture|moto|trottinette|utilitaire|caravane|automobile|berline|citadine|suv|fourgon|electrique/i,
  immobilier: /appartement|location|colocation|loyer|bail|immobilier|maison|investissement locatif|locataire|bailleur/i,
  multimedia: /smartphone|iphone|samsung|pc|ordinateur|console|playstation|xbox|nintendo|telephone/i,
  mode: /vetement|robe|chaussure|sac|montre|bijoux|mode/i,
  maison: /meuble|canape|table|chaise|electromenager|frigo|deco|jardin|bricolage/i,
  "bebe-enfant": /puericulture|bebe|enfant|poussette|jouet/i,
  loisirs: /velo|bicyclette|sport|musique|instrument|livre|jeu/i,
  "materiel-pro": /materiel pro|btp|chantier|restauration|agriculture|industrie/i,
};

export function getRelatedBlogPosts(categoryId: string, limit = 4): BlogArticle[] {
  const all = getAllArticles();
  const direct = all.filter((a) => a.relatedCategoryId === categoryId);
  if (direct.length >= limit) return direct.slice(0, limit);

  const re = CATEGORY_KEYWORDS[categoryId];
  if (!re) return direct.slice(0, limit);

  const fuzzy = all.filter(
    (a) =>
      a.relatedCategoryId !== categoryId &&
      (re.test(a.title) || re.test(a.description) || a.keywords.some((k) => re.test(k))),
  );

  const merged = [...direct];
  for (const a of fuzzy) {
    if (merged.length >= limit) break;
    if (!merged.some((m) => m.slug === a.slug)) merged.push(a);
  }
  return merged.slice(0, limit);
}

export function getRelatedBlogPostsForCity(
  categoryId: string,
  cityName: string | null,
  limit = 4,
): BlogArticle[] {
  if (!cityName) return getRelatedBlogPosts(categoryId, limit);
  const all = getAllArticles();
  const cityRe = new RegExp(`\\b${cityName.replace(/[-]/g, "[- ]?")}\\b`, "i");
  const cityMatches = all.filter(
    (a) =>
      cityRe.test(a.title) ||
      cityRe.test(a.description) ||
      a.keywords.some((k) => cityRe.test(k)),
  );

  const base = getRelatedBlogPosts(categoryId, limit + cityMatches.length);
  const ordered: BlogArticle[] = [];
  for (const a of cityMatches) if (!ordered.some((o) => o.slug === a.slug)) ordered.push(a);
  for (const a of base) if (!ordered.some((o) => o.slug === a.slug)) ordered.push(a);
  return ordered.slice(0, limit);
}

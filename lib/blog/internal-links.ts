import type { BlogArticle } from "./types";
import { CATEGORIES } from "@/lib/categories";
import { TOP_CITIES, FRENCH_CITIES, citySlug } from "@/lib/cities";
import { CAR_BRANDS } from "@/lib/carBrands";
import { subcategoryToSlug } from "@/lib/seo-content";
import { getSeoInventory } from "@/lib/seo/inventory";
import { isCityCategoryIndexable } from "@/lib/seo/city-category";

export type InternalLink = { label: string; href: string };

const SUB_KEYWORDS: { match: RegExp; categoryId: string; subSlug: string }[] = [
  { match: /trottinette/i, categoryId: "vehicules", subSlug: "trottinettes" },
  { match: /\bmoto(s)?\b/i, categoryId: "vehicules", subSlug: "motos" },
  { match: /voiture|automobile|berline|citadine|suv|break|cabriolet/i, categoryId: "vehicules", subSlug: "voitures" },
  { match: /utilitaire|fourgon|camionnette/i, categoryId: "vehicules", subSlug: "utilitaires" },
  { match: /caravane|camping-?car/i, categoryId: "vehicules", subSlug: "caravaning" },
  { match: /appartement|location|colocation|loyer|bail|locataire|bailleur/i, categoryId: "immobilier", subSlug: "locations" },
  { match: /achat immobilier|acheter (un )?(appartement|maison)|vente immobiliere|investissement locatif/i, categoryId: "immobilier", subSlug: "ventes-immobilieres" },
  { match: /smartphone|iphone|samsung|android/i, categoryId: "multimedia", subSlug: "telephonie" },
  { match: /pc|ordinateur|portable|macbook/i, categoryId: "multimedia", subSlug: "informatique" },
  { match: /console|playstation|ps5|xbox|nintendo/i, categoryId: "multimedia", subSlug: "consoles-jeux-video" },
  { match: /vetement|robe|chaussure|sac|montre/i, categoryId: "mode", subSlug: "vetements" },
  { match: /meuble|canape|table|chaise|armoire/i, categoryId: "maison", subSlug: "ameublement" },
  { match: /electromenager|frigo|lave-(linge|vaisselle)/i, categoryId: "maison", subSlug: "electromenager" },
  { match: /puericulture|bebe|enfant|poussette/i, categoryId: "bebe-enfant", subSlug: "puericulture" },
  { match: /velo|bicyclette/i, categoryId: "loisirs", subSlug: "velos" },
];

const CITY_NAME_PATTERNS = FRENCH_CITIES.slice(0, 50).map((c) => ({
  name: c.name,
  slug: c.slug,
  pattern: new RegExp(`\\b${c.name.replace(/[-]/g, "[- ]?")}\\b`, "i"),
}));

function detectSubcategoryLink(article: BlogArticle): InternalLink | null {
  const haystack = `${article.title} ${article.description} ${article.keywords.join(" ")}`;
  for (const rule of SUB_KEYWORDS) {
    if (rule.match.test(haystack)) {
      const cat = CATEGORIES.find((c) => c.id === rule.categoryId);
      if (!cat) continue;
      const sub = cat.subcategories.find((s) => subcategoryToSlug(s) === rule.subSlug);
      if (!sub) continue;
      return {
        label: `Voir les annonces ${sub}`,
        href: `/annonces/${cat.id}/${rule.subSlug}`,
      };
    }
  }
  return null;
}

function detectBrandLink(article: BlogArticle): InternalLink | null {
  const haystack = `${article.title} ${article.description}`;
  for (const brand of CAR_BRANDS) {
    const slug = brand.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const re = new RegExp(`\\b${brand.name.replace(/[-]/g, "[- ]?")}\\b`, "i");
    if (re.test(haystack)) {
      return {
        label: `Voir les annonces ${brand.name}`,
        href: `/annonces/vehicules/${slug}`,
      };
    }
  }
  return null;
}

function detectCityLinks(article: BlogArticle, sub: InternalLink | null, max: number): InternalLink[] {
  const haystack = `${article.title} ${article.description} ${article.keywords.join(" ")}`;
  const matched: { name: string; slug: string }[] = [];
  for (const c of CITY_NAME_PATTERNS) {
    if (c.pattern.test(haystack)) matched.push({ name: c.name, slug: c.slug });
    if (matched.length >= max) break;
  }
  if (matched.length === 0) return [];

  const cat = sub
    ? CATEGORIES.find((c) => sub.href.startsWith(`/annonces/${c.id}/`))
    : article.relatedCategoryId
      ? CATEGORIES.find((c) => c.id === article.relatedCategoryId)
      : null;

  if (!cat) return [];

  const subPart = sub?.href.split("/")[3];
  return matched.map((c) => ({
    label: subPart
      ? `${cat.subcategories.find((s) => subcategoryToSlug(s) === subPart) ?? cat.label} à ${c.name}`
      : `${cat.label} à ${c.name}`,
    href: subPart
      ? `/annonces/${cat.id}/${subPart}/${c.slug}`
      : `/annonces/${cat.id}/${c.slug}`,
  }));
}

/**
 * Liens internes d'un article de blog.
 *
 * Le blog est aujourd'hui le meilleur actif du site en référencement — donc
 * l'endroit d'où partent les liens qui comptent le plus. Il détectait les noms
 * de villes cités dans un article et émettait jusqu'à quatre liens
 * `/annonces/{catégorie}/{ville}`, sans jamais vérifier que ces pages avaient
 * quelque chose à montrer. Un article mentionnant Metz, Calais et Chartres
 * offrait ainsi trois portes d'entrée vers des pages vides — depuis les pages
 * les plus explorées du domaine.
 *
 * Fonction devenue asynchrone pour cette seule raison : elle doit consulter
 * l'inventaire. L'appel ne coûte rien, l'instantané étant déjà en cache.
 */
export async function getArticleInternalLinks(article: BlogArticle): Promise<InternalLink[]> {
  const links: InternalLink[] = [];

  const sub = detectSubcategoryLink(article);
  const brand = detectBrandLink(article);
  const inventory = await getSeoInventory().catch(() => null);
  const cities = inventory
    ? detectCityLinks(article, sub, 4).filter((link) => {
        // `/annonces/{cat}/{ville}` ou `/annonces/{cat}/{sub}/{ville}`
        const [, , categoryId, ...rest] = link.href.split("/");
        const targetCity = rest[rest.length - 1];
        const targetSub = rest.length > 1 ? rest[0] : null;
        return isCityCategoryIndexable(inventory, categoryId, targetCity, targetSub);
      })
    : [];

  if (sub) links.push(sub);
  if (brand && brand.href !== sub?.href) links.push(brand);
  links.push(...cities);

  if (article.relatedCategoryId && !links.some((l) => l.href === `/annonces/${article.relatedCategoryId}`)) {
    const cat = CATEGORIES.find((c) => c.id === article.relatedCategoryId);
    if (cat) {
      links.push({
        label: `Toutes les annonces ${cat.label}`,
        href: `/annonces/${cat.id}`,
      });
    }
  }

  // Dedupe by href
  const seen = new Set<string>();
  return links.filter((l) => {
    if (seen.has(l.href)) return false;
    seen.add(l.href);
    return true;
  });
}

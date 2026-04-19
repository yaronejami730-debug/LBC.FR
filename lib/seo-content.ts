import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { CATEGORIES, getCategoryById } from "@/lib/categories";
import { slugToCity, type FrenchCity } from "@/lib/cities";

export type SeoFaqItem = { q: string; a: string };

export type SeoContent = {
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  localTips: string | null;
  faq: SeoFaqItem[];
  keywords: string[];
};

export type SeoPageTarget = {
  categoryId: string;
  subcategorySlug?: string;
  citySlug?: string;
};

export function subcategoryToSlug(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugToSubcategoryLabel(categoryId: string, slug: string): string | null {
  const cat = getCategoryById(categoryId);
  if (!cat) return null;
  const match = cat.subcategories.find((s) => subcategoryToSlug(s) === slug);
  return match ?? null;
}

export function pageKey(target: SeoPageTarget): string {
  return [target.categoryId, target.subcategorySlug ?? "_", target.citySlug ?? "_"].join(":");
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(target: SeoPageTarget, city: FrenchCity | null, subLabel: string | null): string {
  const cat = getCategoryById(target.categoryId);
  if (!cat) throw new Error(`Unknown category ${target.categoryId}`);

  const scope = [
    `Catégorie: ${cat.label}`,
    subLabel ? `Sous-catégorie: ${subLabel}` : null,
    city ? `Ville: ${city.name} (${city.department}, ${city.region}, ~${city.population.toLocaleString("fr-FR")} habitants)` : `Zone: France entière`,
  ].filter(Boolean).join("\n");

  return `Tu es un rédacteur SEO expert pour un site de petites annonces français (Deal&Co, dealandcompany.fr), concurrent direct de Leboncoin.

Génère le contenu SEO pour cette page :
${scope}

Contraintes strictes :
- Français naturel, pas de formules creuses, pas de langue de bois.
- Pas de promesses factuelles vérifiables (prix, statistiques chiffrées, classements) que tu ne peux pas sourcer.
- Contenu 100% unique, adapté à la combinaison exacte ci-dessus.
- Ton neutre et informatif, avec quelques éléments de contexte local quand une ville est indiquée.
- Aucune mention de concurrents par nom.
- Intègre naturellement la catégorie${subLabel ? ", la sous-catégorie" : ""}${city ? " et le nom de la ville" : ""} dans le contenu.
- Pas de markdown, pas d'emojis, pas de listes avec tirets.

Produis UNIQUEMENT un objet JSON valide (aucun texte avant/après), avec ces clés :
{
  "metaTitle": "60 caractères max, percutant, inclut la catégorie${city ? " et la ville" : ""}",
  "metaDescription": "155 caractères max, accrocheur, inclut un call-to-action",
  "h1": "titre principal de la page, différent du metaTitle",
  "intro": "paragraphe d'introduction de 80 à 130 mots, unique et informatif",
  "localTips": ${city ? `"paragraphe de 60 à 100 mots avec des conseils pratiques pour acheter/vendre des ${subLabel ?? cat.label} à ${city.name} (quartiers, points de rencontre habituels, spécificités locales pertinentes)"` : `null`},
  "faq": [
    {"q": "question 1", "a": "réponse 2-3 phrases"},
    {"q": "question 2", "a": "réponse 2-3 phrases"},
    {"q": "question 3", "a": "réponse 2-3 phrases"},
    {"q": "question 4", "a": "réponse 2-3 phrases"}
  ],
  "keywords": ["5 à 8 mots-clés longue traîne pertinents"]
}`;
}

function parseJsonFromResponse(text: string): SeoContent {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const parsed = JSON.parse(cleaned);

  if (!parsed.metaTitle || !parsed.metaDescription || !parsed.h1 || !parsed.intro) {
    throw new Error("Réponse IA incomplète");
  }

  return {
    metaTitle: String(parsed.metaTitle).slice(0, 70),
    metaDescription: String(parsed.metaDescription).slice(0, 170),
    h1: String(parsed.h1),
    intro: String(parsed.intro),
    localTips: parsed.localTips ? String(parsed.localTips) : null,
    faq: Array.isArray(parsed.faq)
      ? parsed.faq.filter((f: any) => f?.q && f?.a).map((f: any) => ({ q: String(f.q), a: String(f.a) }))
      : [],
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map((k: any) => String(k)) : [],
  };
}

export async function generateSeoContent(target: SeoPageTarget): Promise<SeoContent> {
  const cat = getCategoryById(target.categoryId);
  if (!cat) throw new Error(`Unknown category ${target.categoryId}`);

  const city = target.citySlug ? slugToCity(target.citySlug) ?? null : null;
  const subLabel = target.subcategorySlug ? slugToSubcategoryLabel(target.categoryId, target.subcategorySlug) : null;

  const prompt = buildPrompt(target, city, subLabel);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("Réponse IA vide");

  return parseJsonFromResponse(block.text);
}

export async function getOrCreateSeoContent(target: SeoPageTarget): Promise<SeoContent | null> {
  const key = pageKey(target);
  const existing = await prisma.seoPageContent.findUnique({ where: { pageKey: key } }).catch(() => null);

  if (existing) {
    return {
      metaTitle: existing.metaTitle,
      metaDescription: existing.metaDescription,
      h1: existing.h1,
      intro: existing.intro,
      localTips: existing.localTips,
      faq: JSON.parse(existing.faq) as SeoFaqItem[],
      keywords: JSON.parse(existing.keywords) as string[],
    };
  }

  try {
    const content = await generateSeoContent(target);
    await prisma.seoPageContent.create({
      data: {
        pageKey: key,
        categoryId: target.categoryId,
        subcategorySlug: target.subcategorySlug ?? null,
        citySlug: target.citySlug ?? null,
        metaTitle: content.metaTitle,
        metaDescription: content.metaDescription,
        h1: content.h1,
        intro: content.intro,
        localTips: content.localTips,
        faq: JSON.stringify(content.faq),
        keywords: JSON.stringify(content.keywords),
        model: "claude-haiku-4-5",
      },
    });
    return content;
  } catch (err) {
    console.error("[seo-content] génération échouée", key, err);
    return null;
  }
}

export function fallbackContent(target: SeoPageTarget): SeoContent {
  const cat = getCategoryById(target.categoryId);
  const city = target.citySlug ? slugToCity(target.citySlug) : null;
  const subLabel = target.subcategorySlug ? slugToSubcategoryLabel(target.categoryId, target.subcategorySlug) : null;

  const label = cat?.label ?? target.categoryId;
  const segment = subLabel ?? label;
  const where = city ? ` à ${city.name}` : " en France";

  return {
    metaTitle: `Annonces ${segment}${where} | Deal&Co`,
    metaDescription: `Achetez et vendez des ${segment.toLowerCase()}${where} sur Deal&Co. Petites annonces gratuites entre particuliers.`,
    h1: `Annonces ${segment}${where}`,
    intro: `Retrouvez toutes les annonces ${segment.toLowerCase()}${where} sur Deal&Co. Achat, vente et échange entre particuliers.`,
    localTips: null,
    faq: [],
    keywords: [segment.toLowerCase(), city?.name.toLowerCase() ?? "france"],
  };
}

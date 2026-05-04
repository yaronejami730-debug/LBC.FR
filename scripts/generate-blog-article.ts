import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const POSTS_DIR = join(process.cwd(), "lib/blog/posts");
const INDEX_FILE = join(process.cwd(), "lib/blog/index.ts");

type GeneratedArticle = {
  slug: string;
  title: string;
  description: string;
  category: string;
  keywords: string[];
  intro: string;
  sections: { h2: string; paragraphs: string[] }[];
  faq: { q: string; a: string }[];
  relatedCategoryId?: string;
};

const CATEGORIES_FOR_AI = [
  { id: "vehicules", label: "Véhicules" },
  { id: "immobilier", label: "Immobilier" },
  { id: "multimedia", label: "Multimédia" },
  { id: "mode", label: "Mode" },
  { id: "maison", label: "Maison" },
  { id: "loisirs", label: "Loisirs" },
  { id: "animaux", label: "Animaux" },
  { id: "services", label: "Services" },
  { id: "emploi", label: "Emploi" },
  { id: "bebe-enfant", label: "Bébé & Enfant" },
  { id: "vacances", label: "Vacances" },
];

function buildPrompt(topic: string): string {
  return `Tu es rédacteur SEO senior pour Deal&Co (dealandcompany.fr), site français de petites annonces entre particuliers.

Génère un article de blog complet et original sur le sujet suivant :
"${topic}"

Contraintes éditoriales :
- Français naturel, ton informatif, pas de langue de bois.
- Pas de promesses chiffrées que tu ne peux pas sourcer (statistiques, classements).
- Tutoiement banni, vouvoiement obligatoire.
- Aucune mention de concurrents par leur nom.
- Pas d'emojis, pas de markdown, pas de liens externes dans le contenu.
- Conseils pratiques, applicables et factuels.
- Article entre 1200 et 1800 mots au total.

Catégories disponibles pour relatedCategoryId (choisis la plus pertinente, ou omets si aucune ne convient) :
${CATEGORIES_FOR_AI.map((c) => `- ${c.id} : ${c.label}`).join("\n")}

Produis UNIQUEMENT un objet JSON valide (aucun texte avant/après), avec ces clés :
{
  "slug": "kebab-case, 4-7 mots, sans accent, sans année",
  "title": "60-70 caractères, percutant, sans nom de marque Deal&Co",
  "description": "150-160 caractères, accrocheur, inclut un bénéfice concret",
  "category": "Catégorie éditoriale courte (ex: Véhicules, Immobilier, Sécurité, Mode)",
  "keywords": ["5 à 8 mots-clés longue traîne pertinents en minuscules"],
  "intro": "paragraphe d'introduction de 80 à 130 mots, accroche le lecteur et annonce le plan",
  "sections": [
    {
      "h2": "titre de section concret, 5 à 9 mots",
      "paragraphs": ["paragraphe 1 (3-5 phrases)", "paragraphe 2", "paragraphe 3"]
    }
  ],
  "faq": [
    {"q": "question utile que se pose le lecteur", "a": "réponse précise en 2-3 phrases"}
  ],
  "relatedCategoryId": "id de catégorie la plus pertinente parmi la liste, ou null"
}

Exigences structure :
- 5 sections h2 minimum.
- Chaque section : 2 à 4 paragraphes de 3 à 5 phrases.
- 4 questions FAQ minimum, factuelles et utiles.
- intro + sections + faq totalisent 1200-1800 mots.`;
}

function articleTemplate(article: GeneratedArticle, today: string): string {
  return `import type { BlogArticle } from "../types";

export const article: BlogArticle = ${JSON.stringify(
    {
      slug: article.slug,
      title: article.title,
      description: article.description,
      publishedAt: today,
      updatedAt: today,
      category: article.category,
      keywords: article.keywords,
      intro: article.intro,
      sections: article.sections,
      faq: article.faq,
      relatedCategoryId: article.relatedCategoryId ?? undefined,
    },
    null,
    2,
  )};
`;
}

function moduleNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("")
    .replace(/[^a-zA-Z0-9]/g, "");
}

function rebuildIndexFile() {
  const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith(".ts"));
  const imports = files
    .map((file) => {
      const slug = file.replace(/\.ts$/, "");
      const name = moduleNameFromSlug(slug);
      return `import { article as ${name} } from "./posts/${slug}";`;
    })
    .join("\n");
  const names = files.map((file) => moduleNameFromSlug(file.replace(/\.ts$/, ""))).join(", ");

  const content = `import type { BlogArticle } from "./types";
${imports}

const articles: BlogArticle[] = [${names}].sort(
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
`;
  writeFileSync(INDEX_FILE, content);
}

async function main() {
  const topic = process.argv.slice(2).join(" ").trim();
  if (!topic) {
    console.error('Usage: npx tsx scripts/generate-blog-article.ts "<sujet de l\'article>"');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY in env");
    process.exit(1);
  }

  console.log(`Generating article for: ${topic}`);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 8000,
    messages: [{ role: "user", content: buildPrompt(topic) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    console.error("No text response from Anthropic");
    process.exit(1);
  }

  const cleaned = textBlock.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  let parsed: GeneratedArticle;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse JSON response:");
    console.error(cleaned);
    process.exit(1);
  }

  const slug = parsed.slug;
  const filename = `${slug}.ts`;
  const filepath = join(POSTS_DIR, filename);

  if (existsSync(filepath)) {
    console.error(`Article already exists at ${filepath}. Choose a different slug.`);
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(filepath, articleTemplate(parsed, today));
  console.log(`Wrote ${filepath}`);

  rebuildIndexFile();
  console.log(`Rebuilt ${INDEX_FILE}`);
  console.log(`Article available at /blog/${slug}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Recherche conversationnelle pilotée par Claude.
 *
 * Approche hybride :
 *   1. Claude extrait des critères structurés depuis la conversation (tool-use).
 *   2. On lance une requête Prisma classique sur ces critères (rapide, prévisible).
 *   3. Un scoring lexical re-classe les résultats sur les mots-clés libres du
 *      texte initial pour rapprocher du sémantique sans nécessiter de vecteurs.
 *
 * Le sémantique pur (embeddings + pgvector) viendra dans un second temps —
 * mais déjà ainsi, la qualité est nettement supérieure à un simple LIKE.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { CAR_BRANDS } from "@/lib/carBrands";
import { FRENCH_CITIES } from "@/lib/cities";

const MODEL_ID = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 600;
const MAX_RESULTS = 12;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export type AIMessage = { role: "user" | "assistant"; content: string };

export type SearchCriteria = {
  category?: string;
  subcategory?: string;
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  city?: string;
  keywords?: string;
  vehicleYearMin?: number;
  vehicleYearMax?: number;
  vehicleKmMax?: number;
  immoSurfaceMin?: number;
  immoRoomsMin?: number;
};

export type AIReply = {
  reply: string;
  criteria: SearchCriteria;
  listings: AIResultListing[];
  total: number;
  /** Suggestions courtes que l'utilisateur peut cliquer pour rebondir. */
  suggestions: string[];
};

export type AIResultListing = {
  id: string;
  title: string;
  price: number;
  location: string;
  images: string;
  createdAt: Date;
  isPremium: boolean;
};

const CATEGORY_LABELS = CATEGORIES.map((c) => c.label);
const SUBCATEGORY_LABELS = Array.from(
  new Set(CATEGORIES.flatMap((c) => c.subcategories)),
);

const DEFAULT_SUGGESTIONS = [
  "Une voiture d'occasion sous 8 000 €",
  "Un appart à louer à Paris",
  "Surprends-moi",
  "Mobilier pas cher près de chez moi",
];

function buildPlayfulReply(total: number, count: number, criteria: SearchCriteria): string {
  if (count === 0) {
    const tip = criteria.priceMax
      ? "Essaie un budget un peu plus large 👀"
      : criteria.city
        ? "Tente sans la ville pour voir ce qui sort ailleurs."
        : "Élargis les critères — je suis sûr qu'il y a quelque chose pour toi.";
    return `Aïe, rien dans le filet pour ces critères. ${tip}`;
  }

  const parts: string[] = [];
  if (criteria.brand) parts.push(criteria.brand);
  else if (criteria.category) parts.push(criteria.category.toLowerCase());
  if (criteria.priceMax) parts.push(`≤ ${criteria.priceMax.toLocaleString("fr-FR")} €`);
  if (criteria.city) parts.push(`à ${criteria.city}`);
  const focus = parts.join(", ");

  const intros = [
    "Voilà, j'ai dégoté",
    "Bingo —",
    "Regarde-moi ça :",
    "Tope-là, j'ai trouvé",
  ];
  const intro = intros[Math.floor(Math.random() * intros.length)];

  if (total > count) {
    return `${intro} ${total} annonces${focus ? ` pour ${focus}` : ""}. Je te montre les ${count} qui collent le mieux 👇`;
  }
  return `${intro} ${count} annonce${count !== 1 ? "s" : ""}${focus ? ` pour ${focus}` : ""} 👇`;
}

const SYSTEM_PROMPT = `Tu es Déborah, l'assistante futée et sympa de Deal&Co (petites annonces entre particuliers en France).

Ton style : direct, chaleureux, un peu malin. Tutoiement. Phrases courtes. Émoji avec parcimonie (max 1 par message). Jamais condescendant, jamais robotique.

Ton job : guider l'utilisateur PAS À PAS via un mini-questionnaire pour comprendre ce qu'il cherche, puis lancer la recherche.

Tu disposes de DEUX outils :

1. \`ask_question\` — utilise-le QUAND tu manques d'infos pour lancer une recherche utile.
   - Pose UNE seule question courte à la fois.
   - Donne 4 à 6 \`choices\` cliquables (max 30 caractères chacun) qui couvrent les réponses typiques + une option "Autre" ou "Surprends-moi" pour les indécis.
   - Ordre conseillé du questionnaire :
     1. **Catégorie** ("Tu cherches quoi ?" → Voiture, Immobilier, Mobilier, Mode, Autre, Surprends-moi)
     2. **Sous-type** adapté à la catégorie (ex. voiture : Citadine / SUV / Berline / Break / Surprends-moi · immo : Appart / Maison / Studio / Colocation)
     3. **Budget** ("Tu vises quel budget ?" → < 1 000 € / < 5 000 € / < 10 000 € / < 20 000 € / Sans limite)
     4. **Ville ou région** ("Près de quelle ville ?" → Paris, Lyon, Marseille, Toulouse, Partout en France)
     5. Question optionnelle spécifique (ex. voiture : essence/diesel/élec ; immo : T1/T2/T3+)

2. \`search_listings\` — utilise-le DÈS que tu as au moins **catégorie + 1 autre critère** (budget, ville, ou type). Pas besoin d'aller jusqu'à 5 questions si l'utilisateur a déjà donné suffisamment d'infos. Mieux vaut chercher tôt et laisser l'utilisateur affiner ensuite.
   - Toujours remplir \`next_suggestions\` (3-4 propositions courtes pour affiner après les résultats : "Plutôt diesel", "Budget plus bas", "Près de Marseille"…).

Règles clés :
- Si la 1ʳᵉ message est précis (ex. "Clio diesel <6000€ Lyon") → va direct à \`search_listings\`, ne pose pas de question inutile.
- Si l'utilisateur clique "Surprends-moi" → lance \`search_listings\` avec ce que tu as, même peu.
- Ne jamais inventer un prix, une marque ou une ville absente du message.
- Catégories disponibles : ${CATEGORY_LABELS.join(", ")}.
- Marques voitures connues : ${CAR_BRANDS.slice(0, 30).map((b) => b.name).join(", ")}.`;

const SEARCH_TOOL = {
  name: "search_listings",
  description: "Lance la recherche d'annonces avec les critères extraits + 3-4 suggestions pour affiner.",
  input_schema: {
    type: "object" as const,
    properties: {
      category: { type: "string", enum: CATEGORY_LABELS, description: "Catégorie principale" },
      subcategory: { type: "string", enum: SUBCATEGORY_LABELS, description: "Sous-catégorie" },
      brand: { type: "string", description: "Marque pour voitures, ex. Renault, Peugeot, BMW" },
      priceMin: { type: "number", description: "Prix minimum en euros" },
      priceMax: { type: "number", description: "Prix maximum en euros" },
      city: { type: "string", description: "Ville ou département recherché" },
      keywords: { type: "string", description: "Mots-clés libres décrivant l'objet recherché" },
      vehicleYearMin: { type: "number" },
      vehicleYearMax: { type: "number" },
      vehicleKmMax: { type: "number", description: "Kilométrage maximum" },
      immoSurfaceMin: { type: "number", description: "Surface minimale en m²" },
      immoRoomsMin: { type: "number", description: "Nombre minimal de pièces" },
      next_suggestions: {
        type: "array",
        items: { type: "string", maxLength: 50 },
        minItems: 3,
        maxItems: 4,
        description: "3 à 4 suggestions courtes (≤ 50 caractères) pour affiner après les résultats.",
      },
    },
    required: ["next_suggestions"],
  },
};

const ASK_TOOL = {
  name: "ask_question",
  description: "Pose UNE question au questionnaire avec 4-6 choix cliquables. À utiliser tant que tu n'as pas assez d'infos pour search_listings.",
  input_schema: {
    type: "object" as const,
    properties: {
      question: { type: "string", description: "Question courte et amicale (≤ 100 caractères)." },
      choices: {
        type: "array",
        items: { type: "string", maxLength: 30 },
        minItems: 2,
        maxItems: 6,
        description: "Choix cliquables courts. Inclus une option 'Autre' ou 'Surprends-moi' à la fin.",
      },
    },
    required: ["question", "choices"],
  },
};

function normalizeCity(input: string): string | null {
  const q = input.toLowerCase().trim();
  const match = FRENCH_CITIES.find((c) =>
    c.name.toLowerCase() === q || c.slug === q,
  );
  return match?.name ?? null;
}

function buildWhere(criteria: SearchCriteria) {
  const conditions: Record<string, unknown>[] = [
    { status: "APPROVED" },
    { deletedAt: null },
    { shadowBanned: false },
  ];

  if (criteria.category) conditions.push({ category: criteria.category });
  if (criteria.subcategory) conditions.push({ subcategory: criteria.subcategory });

  if (criteria.priceMin || criteria.priceMax) {
    const price: { gte?: number; lte?: number } = {};
    if (criteria.priceMin) price.gte = criteria.priceMin;
    if (criteria.priceMax) price.lte = criteria.priceMax;
    conditions.push({ price });
  }

  if (criteria.vehicleYearMin || criteria.vehicleYearMax) {
    const y: { gte?: number; lte?: number } = {};
    if (criteria.vehicleYearMin) y.gte = criteria.vehicleYearMin;
    if (criteria.vehicleYearMax) y.lte = criteria.vehicleYearMax;
    conditions.push({ vehicleYear: y });
  }
  if (criteria.vehicleKmMax) conditions.push({ vehicleKm: { lte: criteria.vehicleKmMax } });
  if (criteria.immoSurfaceMin) conditions.push({ immoSurface: { gte: criteria.immoSurfaceMin } });
  if (criteria.immoRoomsMin) conditions.push({ immoRooms: { gte: criteria.immoRoomsMin } });

  if (criteria.city) {
    const canonical = normalizeCity(criteria.city) ?? criteria.city;
    conditions.push({ location: { contains: canonical, mode: "insensitive" } });
  }

  if (criteria.brand) {
    conditions.push({
      OR: [
        { title: { contains: criteria.brand, mode: "insensitive" } },
        { metadata: { contains: criteria.brand, mode: "insensitive" } },
      ],
    });
  }

  if (criteria.keywords) {
    const tokens = criteria.keywords
      .toLowerCase()
      .replace(/[^a-z0-9àâäéèêëïîôöùûüç ]/gi, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
      .slice(0, 6);
    for (const t of tokens) {
      conditions.push({
        OR: [
          { title: { contains: t, mode: "insensitive" } },
          { description: { contains: t, mode: "insensitive" } },
        ],
      });
    }
  }

  return { AND: conditions } as Record<string, unknown>;
}

/**
 * Re-classe les résultats avec un scoring lexical simple sur les mots-clés.
 * Sert de proxy au sémantique : titre > description, mots multiples > mot isolé.
 */
function rerank(listings: AIResultListing[] & { description?: string }[], keywords?: string): AIResultListing[] {
  if (!keywords) return listings;
  const tokens = keywords
    .toLowerCase()
    .replace(/[^a-z0-9àâäéèêëïîôöùûüç ]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
  if (tokens.length === 0) return listings;

  const scored = listings.map((l) => {
    const title = l.title.toLowerCase();
    const desc = ((l as { description?: string }).description ?? "").toLowerCase();
    let score = l.isPremium ? 2 : 0;
    for (const t of tokens) {
      if (title.includes(t)) score += 5;
      if (desc.includes(t)) score += 1;
    }
    return { l, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.l);
}

export async function runAISearch(messages: AIMessage[]): Promise<AIReply> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      reply: "Hmm, mon cerveau dort. Réessaie dans un instant ou utilise la recherche classique 🙏",
      criteria: {},
      listings: [],
      total: 0,
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const client = getClient();

  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [ASK_TOOL, SEARCH_TOOL],
    tool_choice: { type: "auto" },
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  // Identifier le tool utilisé (questionnaire ou recherche).
  let criteria: SearchCriteria = {};
  let suggestions: string[] = [];
  let assistantText = "";
  let askedQuestion: string | null = null;
  let askChoices: string[] = [];

  for (const block of response.content) {
    if (block.type === "text") {
      assistantText += block.text;
    } else if (block.type === "tool_use") {
      if (block.name === "search_listings") {
        const input = (block.input ?? {}) as SearchCriteria & { next_suggestions?: string[] };
        const { next_suggestions, ...rest } = input;
        criteria = rest;
        if (Array.isArray(next_suggestions)) {
          suggestions = next_suggestions.filter((s) => typeof s === "string").slice(0, 4);
        }
      } else if (block.name === "ask_question") {
        const input = (block.input ?? {}) as { question?: string; choices?: string[] };
        askedQuestion = typeof input.question === "string" ? input.question : null;
        if (Array.isArray(input.choices)) {
          askChoices = input.choices.filter((c) => typeof c === "string").slice(0, 6);
        }
      }
    }
  }

  // Phase questionnaire : Claude pose une question, pas de recherche.
  if (askedQuestion) {
    return {
      reply: askedQuestion,
      criteria: {},
      listings: [],
      total: 0,
      suggestions: askChoices.length > 0 ? askChoices : DEFAULT_SUGGESTIONS,
    };
  }

  // Pas de tool appelé, juste du texte : Claude n'a pas suivi le format, fallback.
  const hasCriteria = Object.keys(criteria).length > 0;
  if (!hasCriteria) {
    return {
      reply: assistantText.trim() || "Tu cherches quoi ? Voiture, immobilier, mobilier… ?",
      criteria: {},
      listings: [],
      total: 0,
      suggestions: ["Une voiture", "Un appart", "Du mobilier", "Surprends-moi"],
    };
  }

  const where = buildWhere(criteria);
  const [rawListings, total] = await Promise.all([
    prisma.listing.findMany({
      where: where as any,
      orderBy: [{ isPremium: "desc" }, { createdAt: "desc" }],
      take: MAX_RESULTS * 2,
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        location: true,
        images: true,
        createdAt: true,
        isPremium: true,
      },
    }),
    prisma.listing.count({ where: where as any }),
  ]);

  const ranked = rerank(rawListings as never, criteria.keywords).slice(0, MAX_RESULTS);
  const listings: AIResultListing[] = ranked.map((l) => ({
    id: l.id,
    title: l.title,
    price: l.price,
    location: l.location,
    images: l.images,
    createdAt: l.createdAt,
    isPremium: l.isPremium,
  }));

  const reply = buildPlayfulReply(total, listings.length, criteria);

  // Suggestions de repli si Claude n'en a pas généré.
  if (suggestions.length === 0) {
    suggestions = listings.length === 0
      ? ["Élargir le budget", "Changer de ville", "Surprends-moi", "Voir toutes les annonces"]
      : ["Affiner par prix", "Année plus récente", "Autre ville", "Voir plus d'annonces"];
  }

  return { reply, criteria, listings, total, suggestions };
}

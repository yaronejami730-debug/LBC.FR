import Anthropic from "@anthropic-ai/sdk";

const MODEL_ID = "claude-haiku-4-5-20251001";
const MIN_WORDS = 80;
const TARGET_MIN = 100;
const TARGET_MAX = 150;
const MAX_TOKENS = 400;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

const BUDGET_PER_HOUR = 200;
let budget = { count: 0, resetAt: Date.now() + 3600_000 };
function consumeBudget(): boolean {
  const now = Date.now();
  if (now > budget.resetAt) budget = { count: 0, resetAt: now + 3600_000 };
  if (budget.count >= BUDGET_PER_HOUR) return false;
  budget.count++;
  return true;
}

export type EnrichInput = {
  titre: string;
  description: string;
  categorie: string;
  ville: string;
  prix?: number | null;
};

export type EnrichResult = {
  description: string;
  enriched: boolean;
  reason?: "already-long" | "no-api-key" | "over-budget" | "api-error" | "empty-response";
};

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export async function enrichDescription(input: EnrichInput): Promise<EnrichResult> {
  const original = (input.description ?? "").trim();

  if (wordCount(original) >= MIN_WORDS) {
    return { description: original, enriched: false, reason: "already-long" };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { description: original, enriched: false, reason: "no-api-key" };
  }

  if (!consumeBudget()) {
    return { description: original, enriched: false, reason: "over-budget" };
  }

  const priceLine = input.prix != null ? `${input.prix}€` : "Non renseigné";

  const prompt = `Tu es un rédacteur de petites annonces françaises.
Enrichis cette description d'annonce pour la rendre plus complète et mieux référencée sur Google.
Garde le sens exact, ne rajoute pas d'informations fausses, écris naturellement, en français.
Vise ${TARGET_MIN} à ${TARGET_MAX} mots. Réponds UNIQUEMENT avec la description enrichie, sans introduction ni commentaire.

Titre : ${input.titre}
Catégorie : ${input.categorie}
Ville : ${input.ville}
Prix : ${priceLine}
Description originale : ${original}`;

  try {
    const resp = await getClient().messages.create({
      model: MODEL_ID,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });
    const block = resp.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    if (!text) {
      return { description: original, enriched: false, reason: "empty-response" };
    }
    return { description: text, enriched: true };
  } catch (err) {
    console.error("[enrichDescription] Anthropic call failed:", err);
    return { description: original, enriched: false, reason: "api-error" };
  }
}

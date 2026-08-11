import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUserId } from "@/lib/auth-unified";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Quota par compte : de quoi rédiger une dizaine d'annonces d'affilée, pas de
 * quoi boucler. La clé est l'identifiant du compte et non l'IP — l'IP change
 * en mobile, et c'est le compte qui engage la dépense.
 */
const DAILY_LIMIT = 30;
const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Assistance à la rédaction d'annonce.
 *
 * Chaque appel consomme du budget Anthropic facturé au projet. La route était
 * ouverte : sans session ni quota, n'importe qui pouvait la boucler et faire
 * grimper la note. D'où deux verrous — un compte connecté, un plafond
 * journalier — et une image restreinte à nos propres domaines, la récupération
 * d'une URL arbitraire côté serveur étant un SSRF.
 */
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Connectez-vous pour utiliser l'assistant." }, { status: 401 });
  }

  if (!rateLimit(`ai-assist:${userId}`, DAILY_LIMIT, WINDOW_MS)) {
    return NextResponse.json(
      { error: "Limite quotidienne atteinte pour l'assistant de rédaction." },
      { status: 429 },
    );
  }

  const { title, category, subcategory, imageUrl } = await req.json();
  if (!title || !category) {
    return NextResponse.json({ error: "title and category required" }, { status: 400 });
  }

  type ContentBlock =
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
    | { type: "text"; text: string };

  const content: ContentBlock[] = [];

  if (imageUrl && isAllowedImageHost(imageUrl)) {
    try {
      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) });
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const rawType = imgRes.headers.get("content-type") || "image/jpeg";
        const mediaType = rawType.split(";")[0].trim() as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
        content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } });
      }
    } catch {
      // skip — text-only fallback
    }
  }

  content.push({
    type: "text",
    text: `Tu es expert en rédaction d'annonces pour un site de petites annonces français (dealandcompany.fr).

Informations sur l'article :
- Titre actuel : ${title}
- Catégorie : ${category}${subcategory ? ` > ${subcategory}` : ""}
${content.length > 1 ? "- Une photo est fournie — décris ce que tu observes." : ""}

Génère un JSON strict avec ces champs exactement :
{
  "titre": "titre optimisé, max 80 caractères, accrocheur et précis (marque/modèle si identifiable)",
  "description": "description de 4 à 6 phrases naturelles en français : état réel, points forts, accessoires inclus si visibles, raison de vente plausible. Pas de majuscules abusives.",
  "prixMin": estimation basse en euros (entier, 0 si impossible à estimer),
  "prixMax": estimation haute en euros (entier, 0 si impossible à estimer),
  "etat": "Neuf" ou "Très bon état" ou "Bon état" ou "État correct" ou "Pour pièces"
}

Réponds UNIQUEMENT avec le JSON valide, aucun autre texte.`,
  });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{ role: "user", content: content as Anthropic.MessageParam["content"] }],
  });

  const text = message.content[0]?.type === "text" ? message.content[0].text : null;
  if (!text) return NextResponse.json({ error: "Empty response" }, { status: 502 });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "No JSON in response", raw: text.slice(0, 300) }, { status: 502 });

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "JSON parse error", raw: text.slice(0, 300) }, { status: 502 });
  }
}

/**
 * L'image doit venir de notre propre stockage.
 *
 * Le client envoie l'URL d'une photo qu'il vient de téléverser ; elle est donc
 * toujours sur Supabase ou sur notre domaine. Accepter n'importe quelle URL
 * ferait de cette route un émetteur de requêtes contrôlé de l'extérieur —
 * capable d'atteindre un service interne invisible depuis Internet.
 */
function isAllowedImageHost(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
    return (
      url.hostname === supabaseHost ||
      url.hostname === "www.dealandcompany.fr" ||
      url.hostname.endsWith(".supabase.co")
    );
  } catch {
    return false;
  }
}

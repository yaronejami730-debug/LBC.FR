import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
};

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return false;
  const role = (session.user as any)?.role;
  if (role === "ADMIN") return true;
  const db = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  return db?.role === "ADMIN";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Extract tab URLs from raw HTML — looks for common tab link patterns */
function extractTabUrls(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const found = new Set<string>();

  // Patterns: href with ?tab=, /onglet/, #section, data-tab, aria-controls
  const patterns = [
    /href=["']([^"']*(?:\?|&)(?:tab|onglet|section|page)=[^"']+)["']/gi,
    /href=["']([^"']*\/(?:details?|financier|dpe|diagnostic|quartier|carte|caracteristique)[^"']*)["']/gi,
    /"(?:url|href|link)":\s*"([^"]*\/(?:details?|financier|dpe|diagnostic|quartier|caracteristique)[^"]*)"/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      try {
        const resolved = new URL(match[1], base.origin).href;
        // Only same-origin, not the same as the base URL
        if (resolved.startsWith(base.origin) && resolved !== baseUrl && !resolved.includes("#")) {
          found.add(resolved);
        }
      } catch { /* ignore */ }
    }
  }

  return [...found].slice(0, 4); // max 4 extra tabs
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return res.text();
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  }

  const { url } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL manquante" }, { status: 400 });
  }

  // ── 1. Fetch main page ────────────────────────────────────────────────────────
  let mainHtml = "";
  try {
    mainHtml = await fetchPage(url);
  } catch (err: any) {
    return NextResponse.json({ error: `Impossible de charger la page : ${err.message}` }, { status: 422 });
  }

  // ── 2. Detect & fetch tabs ────────────────────────────────────────────────────
  const tabUrls = extractTabUrls(mainHtml, url);
  const tabTexts: string[] = [];

  await Promise.allSettled(
    tabUrls.map(async (tabUrl) => {
      try {
        const html = await fetchPage(tabUrl);
        const text = stripHtml(html).slice(0, 15_000);
        tabTexts.push(`\n\n--- Onglet : ${tabUrl} ---\n${text}`);
      } catch { /* ignore failing tabs */ }
    })
  );

  // ── 3. Combine content ────────────────────────────────────────────────────────
  const mainText = stripHtml(mainHtml).slice(0, 50_000);
  const fullContent = mainText + tabTexts.join("");

  // ── 4. Ask Claude ─────────────────────────────────────────────────────────────
  const prompt = `Tu es un assistant qui extrait les informations d'une annonce immobilière ou de vente depuis le texte brut d'une ou plusieurs pages web (page principale + onglets détectés automatiquement).

Source : ${url}
${tabUrls.length > 0 ? `Onglets supplémentaires analysés : ${tabUrls.join(", ")}` : ""}

---
${fullContent}
---

Extrais TOUTES les informations disponibles dans l'ensemble du texte (y compris les onglets) et réponds UNIQUEMENT avec un objet JSON valide (pas de markdown, pas d'explication) :

{
  "title": "titre de l'annonce",
  "price": 12345,
  "description": "description complète",
  "location": "ville ou code postal",
  "condition": "Neuf | Très bon état | Bon état | État correct | Pour pièces | null",
  "category": "Immobilier | Véhicules | Multimédia | Mode | Maison | Loisirs | Animaux | Services | Divers",
  "subcategory": "sous-catégorie si disponible",
  "phone": "numéro de téléphone si affiché",
  "vehicle": {
    "marque": null, "modele": null, "annee": null, "kilometrage": null,
    "carburant": null, "transmission": null, "couleur": null,
    "immatriculation": null, "puissanceFiscale": null, "nombrePortes": null
  },
  "immo": {
    "typeBien": null, "surface": null, "nombrePieces": null, "nombreChambres": null,
    "nombreSallesEau": null, "etage": null, "exposition": null,
    "typeCharuffe": null, "modeCharuffe": null, "placesParking": null,
    "anneeConstruction": null, "etatBien": null, "reference": null,
    "classeEnergie": null, "ges": null,
    "vueMer": false, "visAVis": false,
    "prixHonorairesInclus": null, "prixHonorairesExclus": null,
    "honorairesAcquereur": null, "taxeFonciere": null,
    "caracteristiques": []
  }
}

Règles :
- price doit être un nombre (entier ou décimal), jamais une chaîne
- Si c'est un véhicule, remplis le bloc "vehicle" et ignore "immo"
- Si c'est de l'immobilier, remplis le bloc "immo" et ignore "vehicle"
- Traduis en français si le texte source est dans une autre langue
- Cherche dans TOUS les onglets, pas seulement la page principale
- Ne génère RIEN d'autre que le JSON`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Réponse invalide de l'IA");

    const data = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      ok: true,
      data,
      tabsFound: tabUrls.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: `Erreur IA : ${err.message}` }, { status: 500 });
  }
}

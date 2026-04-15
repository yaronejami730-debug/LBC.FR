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
  // 80k pour capturer toutes les sections/onglets cachés dans le même HTML
  const mainText = stripHtml(mainHtml).slice(0, 80_000);
  const fullContent = mainText + tabTexts.join("");

  // ── 4. Ask Claude ─────────────────────────────────────────────────────────────
  const SYSTEM = `Tu es un extracteur d'annonces immobilières et automobiles expert. Tu analyses le texte brut d'une page web (qui peut contenir plusieurs onglets/sections dans le même HTML : Général, Détails, Financier, DPE/Énergie, Quartier, Carte…) et tu extrais TOUTES les données structurées disponibles.

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte autour.
- "price" est toujours un nombre (jamais une chaîne).
- Si c'est un véhicule, remplis "vehicle" et laisse "immo" avec des nulls.
- Si c'est de l'immobilier, remplis "immo" et laisse "vehicle" avec des nulls.
- Le contenu est une page avec plusieurs sections/onglets (parfois cachés) dans le même HTML. TOUTES les sections sont présentes dans le texte — cherche bien partout, même dans les parties qui semblent répétées ou désordonnées.
- Pour l'immobilier : cherche spécifiquement les données DPE (classe énergie A→G, GES A→G, consommation kWh/m²/an), les données financières (honoraires, taxe foncière, charges), et les caractéristiques (balcon, garage, jardin, piscine…).
- Traduis en français si la source est dans une autre langue.
- Pour les véhicules, extrais TOUS les équipements/options dans "vehicle.options".
- "vehicle.critAir" : chiffre Crit'Air si mentionné (0 à 5).
- "vehicle.emissionCO2" : grammes/km (nombre).
- "vehicle.consoUrbaine/consoExtraU/consoMixte" : L/100km (nombre).
- Pour "caracteristiques" immobilier : liste TOUS les équipements et caractéristiques mentionnés (cave, garage, terrasse, jardin, piscine, double vitrage, volets roulants, digicode, interphone, gardien, ascenseur…).
- Si une valeur n'est pas trouvée, mets null (pas une chaîne vide).

SCHÉMA DE SORTIE :
{
  "title": string,
  "price": number,
  "description": string,
  "location": string,
  "condition": "Neuf"|"Très bon état"|"Bon état"|"État correct"|"Pour pièces"|null,
  "category": "Immobilier"|"Véhicules"|"Multimédia"|"Mode"|"Maison"|"Loisirs"|"Animaux"|"Services"|"Divers",
  "subcategory": string|null,
  "phone": string|null,
  "vehicle": {
    "marque": string|null, "modele": string|null, "annee": number|null,
    "kilometrage": number|null, "carburant": string|null, "transmission": string|null,
    "couleur": string|null, "immatriculation": string|null,
    "puissanceFiscale": number|null, "nombrePortes": number|null,
    "motorisation": string|null, "nombreVitesses": number|null,
    "nombrePlaces": number|null, "typeVehicule": string|null,
    "dateImmatriculation": string|null, "critAir": string|null,
    "emissionCO2": number|null, "consoUrbaine": number|null,
    "consoExtraU": number|null, "consoMixte": number|null,
    "options": string[]
  },
  "immo": {
    "typeBien": string|null, "surface": number|null, "nombrePieces": number|null,
    "nombreChambres": number|null, "nombreSallesEau": number|null,
    "etage": string|null, "exposition": string|null,
    "typeCharuffe": string|null, "modeCharuffe": string|null,
    "placesParking": number|null, "anneeConstruction": number|null,
    "etatBien": string|null, "reference": string|null,
    "classeEnergie": string|null, "ges": string|null,
    "vueMer": boolean, "visAVis": boolean,
    "prixHonorairesInclus": number|null, "prixHonorairesExclus": number|null,
    "honorairesAcquereur": number|null, "taxeFonciere": number|null,
    "caracteristiques": string[]
  }
}`;

  const userContent = `Source : ${url}
${tabUrls.length > 0 ? `Onglets supplémentaires analysés : ${tabUrls.join(", ")}` : ""}

---
${fullContent}
---`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4000,
      system: [
        {
          type: "text",
          text: SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
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

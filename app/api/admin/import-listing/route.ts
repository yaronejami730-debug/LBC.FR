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
    // Conserver les valeurs des attributs data-* et alt/title qui contiennent souvent DPE, classe énergie, etc.
    .replace(/<[^>]*\s(?:data-[a-z-]+=["']([^"']+)["'])[^>]*>/gi, (_, val) => ` ${val} `)
    .replace(/<img[^>]*\salt=["']([^"']+)["'][^>]*>/gi, (_, alt) => ` ${alt} `)
    .replace(/<[^>]*\stitle=["']([^"']+)["'][^>]*>/gi, (_, title) => ` ${title} `)
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
  const SYSTEM = `Tu es un extracteur d'annonces immobilières et automobiles expert. Tu analyses le texte brut d'une page web qui contient PLUSIEURS SECTIONS/ONGLETS dans le même HTML (Général, Détails, Financier, DPE/Énergie, Quartier, Carte…). TOUTES ces sections sont présentes dans le texte, même si elles semblent désordonnées ou répétées. Tu dois tout extraire.

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte autour.
- "price" est toujours un nombre (jamais une chaîne). Si tu vois "250 000 €" → 250000.
- Si c'est un véhicule → remplis "vehicle", laisse "immo" à null.
- Si c'est de l'immobilier → remplis "immo", laisse "vehicle" à null.
- Si une valeur est absente → null (jamais une chaîne vide "").

IMMOBILIER — EXTRACTION OBLIGATOIRE :

1. CHAUFFAGE : cherche "chauffage", "type de chauffage", "mode de chauffage", "énergie de chauffage". Exemples de valeurs typeCharuffe : "Individuel", "Collectif", "Central". Exemples de valeurs modeCharuffe : "Gaz", "Électrique", "Fioul", "Pompe à chaleur", "Bois", "Poêle".

2. DPE / ÉNERGIE : cherche "DPE", "diagnostic de performance", "classe énergie", "classe énergétique", "consommation énergétique", "étiquette énergie", une lettre seule (A/B/C/D/E/F/G) suivie de "kWh". Pour GES/GES : cherche "émission de gaz", "GES", "bilan carbone". Les lettres A→G peuvent apparaître dans des attributs data-*, alt ou title — extrais-les. Ex : "Classe D", "DPE : C", "Énergie : E" → classeEnergie = "D", "C" ou "E".

3. FINANCIER :
   - prixHonorairesInclus : prix AVEC honoraires (FAI, TTC inclus, honoraires inclus)
   - prixHonorairesExclus : prix SANS honoraires (hors honoraires, HH, net vendeur)
   - honorairesAcquereur : montant ou pourcentage des honoraires à charge acquéreur (ex: "4,5%" → note le pourcentage en description si pas de montant fixe)
   - taxeFonciere : taxe foncière annuelle en euros

4. QUARTIER / PROXIMITÉ : cherche les sections "quartier", "à proximité", "commerces", "services", "transports", "écoles", "santé". Liste TOUT ce qui est mentionné dans "servicesProximite" : bar, presse, tabac, cinéma, bibliothèque, supermarché, école, médecin, pharmacie, gare, bus, etc.

5. CARACTÉRISTIQUES : liste TOUS les équipements et points notables : cave, garage, parking, terrasse, balcon, jardin, piscine, dépendance, sous-sol, grenier, double vitrage, volets roulants, digicode, interphone, gardien, ascenseur, cuisine équipée, plain-pied, vue dégagée, vue mer, lumineux, calme…

VÉHICULES :
- Extrais TOUS les équipements dans "vehicle.options".
- critAir : chiffre 0→5.
- emissionCO2 : g/km (nombre).
- consoUrbaine/consoExtraU/consoMixte : L/100km (nombre).

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
    "typeBien": string|null,
    "surface": number|null,
    "nombrePieces": number|null,
    "nombreChambres": number|null,
    "nombreSallesEau": number|null,
    "etage": string|null,
    "exposition": string|null,
    "typeCharuffe": string|null,
    "modeCharuffe": string|null,
    "placesParking": number|null,
    "anneeConstruction": number|null,
    "etatBien": string|null,
    "reference": string|null,
    "classeEnergie": string|null,
    "ges": string|null,
    "conso kWhEnergiePrimaire": number|null,
    "vueMer": boolean,
    "visAVis": boolean,
    "prixHonorairesInclus": number|null,
    "prixHonorairesExclus": number|null,
    "honorairesAcquereur": number|null,
    "taxeFonciere": number|null,
    "caracteristiques": string[],
    "servicesProximite": string[]
  }
}`;

  // (fin du SYSTEM prompt)

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

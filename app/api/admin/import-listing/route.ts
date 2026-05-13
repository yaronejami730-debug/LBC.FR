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

  const body = await req.json();
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const pastedText = typeof body?.text === "string" ? body.text.trim() : "";

  if (!url && !pastedText) {
    return NextResponse.json({ error: "URL ou texte requis" }, { status: 400 });
  }

  let fullContent = "";
  let tabUrls: string[] = [];

  if (pastedText) {
    // ── Paste mode ──────────────────────────────────────────────────────────────
    // The admin has copy-pasted the listing content directly. Skip the fetch and
    // run the AI directly on the cleaned text.
    fullContent = pastedText.slice(0, 80_000);
  } else {
    // ── 1. Fetch main page ──────────────────────────────────────────────────────
    let mainHtml = "";
    try {
      mainHtml = await fetchPage(url);
    } catch (err: any) {
      return NextResponse.json({ error: `Impossible de charger la page : ${err.message}` }, { status: 422 });
    }

    // ── 2. Detect & fetch tabs ──────────────────────────────────────────────────
    tabUrls = extractTabUrls(mainHtml, url);
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

    // ── 3. Combine content ──────────────────────────────────────────────────────
    // 80k pour capturer toutes les sections/onglets cachés dans le même HTML
    const mainText = stripHtml(mainHtml).slice(0, 80_000);
    fullContent = mainText + tabTexts.join("");
  }

  // ── 4. Ask Claude ─────────────────────────────────────────────────────────────
  const SYSTEM = `Tu es un extracteur d'annonces immobilières et automobiles expert. Tu analyses le texte brut d'une page web ou d'un copier-coller qui contient PLUSIEURS SECTIONS/ONGLETS dans le même bloc (Général, Détails, Équipements, Historique d'entretien, Financier, DPE/Énergie, Quartier, Carte…). TOUTES ces sections sont présentes dans le texte, même si elles semblent désordonnées ou répétées. Tu dois tout extraire.

RÈGLES ABSOLUES — NE JAMAIS RÉSUMER, NE JAMAIS INVENTER :
- Tu reproduis EXACTEMENT ce qui est écrit dans le texte source. Mot pour mot pour les éléments structurés (équipements, options, caractéristiques, historique).
- Tu n'inventes JAMAIS un équipement, une option, une caractéristique ou une information qui n'apparaît pas dans le texte source.
- Tu ne résumes JAMAIS une liste d'équipements. Tu reprends TOUS les items, un par un, exactement comme écrit.
- Tu ne paraphrases pas les textes libres (description, historique, informations complémentaires) : tu les reprends quasi mot pour mot, en corrigeant uniquement la ponctuation, les sauts de ligne et les fautes manifestes.
- Si une donnée n'est pas présente dans le texte source → null (ou tableau vide pour les listes). Ne jamais inventer pour combler.

RÈGLES STRICTES DE FORMAT :
- Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte autour.
- "price" est toujours un nombre (jamais une chaîne). Si tu vois "250 000 €" → 250000.
- Si c'est un véhicule → remplis "vehicle", laisse "immo" à null.
- Si c'est de l'immobilier → remplis "immo", laisse "vehicle" à null.
- Si une valeur est absente → null (jamais une chaîne vide "").

CHAMP "description" — STRUCTURÉ ET COMPLET :
La description doit contenir TOUTES les informations textuelles libres présentes dans la source, structurées en sections claires séparées par des sauts de ligne doubles. Utilise les en-têtes suivants si l'information correspondante existe :

"Informations générales :" — la description principale du vendeur, l'état, la raison de la vente, le contexte d'utilisation. Reprends mot pour mot ce qui est écrit.

"Historique d'entretien :" — TOUTES les interventions mentionnées (vidanges, changements de pièces, révisions, courroies, freins, distribution, embrayage, pneus, contrôles techniques, factures…). Reprends date par date, intervention par intervention, mot pour mot. Si rien n'est explicitement annoncé comme historique d'entretien mais que des interventions sont mentionnées dans le texte libre, regroupe-les sous cet en-tête. Si aucun historique n'apparaît, ajoute la ligne "Historique d'entretien : non précisé par le vendeur."

"Informations complémentaires :" — tout autre texte du vendeur n'entrant pas dans les deux catégories précédentes (modalités de visite, transport, livraison, conditions, négociation, raison de la vente s'il n'y est pas déjà, etc.). Si rien à dire, omet la section.

Ne supprime AUCUN paragraphe libre du vendeur. Si tu hésites entre supprimer ou inclure, tu inclus.

IMMOBILIER — EXTRACTION OBLIGATOIRE :

1. CHAUFFAGE : cherche "chauffage", "type de chauffage", "mode de chauffage", "énergie de chauffage". Exemples de valeurs typeCharuffe : "Individuel", "Collectif", "Central". Exemples de valeurs modeCharuffe : "Gaz", "Électrique", "Fioul", "Pompe à chaleur", "Bois", "Poêle".

2. DPE / ÉNERGIE : cherche "DPE", "diagnostic de performance", "classe énergie", "classe énergétique", "consommation énergétique", "étiquette énergie", une lettre seule (A/B/C/D/E/F/G) suivie de "kWh". Pour GES/GES : cherche "émission de gaz", "GES", "bilan carbone". Les lettres A→G peuvent apparaître dans des attributs data-*, alt ou title — extrais-les. Ex : "Classe D", "DPE : C", "Énergie : E" → classeEnergie = "D", "C" ou "E".

3. FINANCIER :
   - prixHonorairesInclus : prix AVEC honoraires (FAI, TTC inclus, honoraires inclus)
   - prixHonorairesExclus : prix SANS honoraires (hors honoraires, HH, net vendeur)
   - honorairesAcquereur : montant ou pourcentage des honoraires à charge acquéreur (ex: "4,5%" → note le pourcentage en description si pas de montant fixe)
   - taxeFonciere : taxe foncière annuelle en euros

4. QUARTIER / PROXIMITÉ : cherche les sections "quartier", "à proximité", "commerces", "services", "transports", "écoles", "santé". Liste TOUT ce qui est mentionné dans "servicesProximite" : bar, presse, tabac, cinéma, bibliothèque, supermarché, école, médecin, pharmacie, gare, bus, etc.

5. CARACTÉRISTIQUES : liste TOUS les équipements et points notables MENTIONNÉS DANS LE TEXTE. Reprends-les mot pour mot tels qu'ils apparaissent (ex : si le vendeur écrit "double vitrage performant", garde "double vitrage performant", pas juste "double vitrage"). N'invente jamais d'équipement absent du texte. Exemples typiques quand mentionnés : cave, garage, parking, terrasse, balcon, jardin, piscine, dépendance, sous-sol, grenier, double vitrage, volets roulants, digicode, interphone, gardien, ascenseur, cuisine équipée, plain-pied, vue dégagée, vue mer, lumineux, calme.

VÉHICULES — RÈGLES SPÉCIFIQUES POUR LES ÉQUIPEMENTS :

- "vehicle.options" doit contenir TOUS les équipements explicitement listés dans le texte source, un par item, exactement comme écrit.
- Si le texte liste 47 équipements, tu mets les 47, sans en omettre un seul, sans en regrouper plusieurs en un. Pas de raccourci, pas de "et plus encore".
- Si le texte ne liste explicitement aucun équipement (cas rare) → tableau vide []. NE PAS INVENTER une liste plausible.
- Reprends la formulation exacte : "Régulateur de vitesse adaptatif" ne devient pas "Régulateur de vitesse" et inversement.
- Si plusieurs équipements sont sur une même ligne séparés par des virgules ou des points-virgules, sépare-les en items distincts.

Autres règles véhicule :
- critAir : chiffre 0→5 uniquement si présent.
- emissionCO2 : g/km (nombre).
- consoUrbaine/consoExtraU/consoMixte : L/100km (nombre).
- L'historique d'entretien d'un véhicule (révisions, courroies, vidanges, factures) doit aller dans la "description" sous l'en-tête "Historique d'entretien :", PAS dans "options".

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

  const userContent = pastedText
    ? `Source : texte collé manuellement par l'administrateur.

---
${fullContent}
---`
    : `Source : ${url}
${tabUrls.length > 0 ? `Onglets supplémentaires analysés : ${tabUrls.join(", ")}` : ""}

---
${fullContent}
---`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8000,
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

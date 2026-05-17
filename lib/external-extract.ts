/**
 * Extraction d'annonces externes — pipeline générique fetch HTML → Claude → JSON.
 *
 * Utilisé par le script de sync `scripts/sync-bsk.ts` (et tout futur connecteur
 * vers un autre site source). L'extraction Claude est la même que celle de
 * `/api/admin/import-listing` (extraction de champs structurés depuis HTML),
 * pas de la modération.
 *
 * Conforme au principe « pas d'IA générative pour la décision » : ici c'est
 * uniquement de la lecture de page web → champs structurés, jamais de verdict.
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
};

const SYSTEM = `Tu es un extracteur d'annonces immobilières et automobiles expert. Tu analyses le texte brut d'une page web qui contient PLUSIEURS SECTIONS dans le même bloc (Général, Détails, Équipements, Financier, DPE/Énergie, Quartier…). Tu dois tout extraire.

RÈGLES ABSOLUES — NE JAMAIS RÉSUMER, NE JAMAIS INVENTER :
- Reproduire EXACTEMENT le texte source. Mot pour mot pour les éléments structurés.
- N'inventer JAMAIS un équipement, une option ou une caractéristique absente du texte.
- Pour la description : reprendre le texte libre du vendeur quasi mot pour mot, en corrigeant uniquement ponctuation et fautes manifestes.
- Si une donnée n'apparaît pas → null (tableau vide pour les listes).

FORMAT :
- Réponds UNIQUEMENT avec un objet JSON valide, sans markdown.
- "price" est toujours un nombre (jamais une chaîne). "250 000 €" → 250000.
- "title" : descriptif, ≤ 200 caractères.
- Si c'est un véhicule → remplis "vehicle", laisse "immo" à null. Inversement pour l'immobilier.

DESCRIPTION STRUCTURÉE :
La description doit contenir TOUTES les informations textuelles libres présentes, organisées en sections séparées par des sauts de ligne doubles :

"Informations générales :" — description principale, état, contexte d'utilisation.
"Historique d'entretien :" — pour un véhicule, TOUTES les interventions (vidanges, courroies, freins, factures, contrôles techniques). Si aucun → "Historique d'entretien : non précisé par le vendeur."
"Informations complémentaires :" — visites, livraison, conditions, négociation, raison de la vente.

Ne supprime aucun paragraphe libre du vendeur.

IMMOBILIER — EXTRACTION OBLIGATOIRE :
- CHAUFFAGE : "type de chauffage", "mode de chauffage". typeCharuffe : "Individuel"|"Collectif"|"Central". modeCharuffe : "Gaz"|"Électrique"|"Fioul"|"Pompe à chaleur"|"Bois"|"Poêle à granulés".
- DPE / GES : lettres A-G ; classeEnergie + ges.
- FINANCIER : prixHonorairesInclus (FAI/TTC), prixHonorairesExclus (HH/net vendeur), honorairesAcquereur (montant), taxeFonciere.
- CARACTÉRISTIQUES : équipements MENTIONNÉS dans le texte (cave, garage, terrasse, balcon, jardin, piscine, double vitrage, volets roulants, digicode, interphone, ascenseur, cuisine équipée, vue mer, plain-pied…). Reprends mot pour mot.
- PROXIMITÉ : commerces, écoles, transports listés dans "servicesProximite".

VÉHICULES — ÉQUIPEMENTS :
- "vehicle.options" contient TOUS les équipements explicitement listés, un par item, exactement comme écrits. Pas de raccourci, pas de "et plus".
- Si aucun équipement listé → tableau vide []. NE PAS INVENTER.
- L'historique d'entretien va dans "description" sous "Historique d'entretien :", PAS dans options.

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
  "vehicle": null | {
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
  "immo": null | {
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

/** Nettoie le HTML en texte lisible — préserve alt/title/data-* utiles. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*\s(?:data-[a-z-]+=["']([^"']+)["'])[^>]*>/gi, (_, val) => ` ${val} `)
    .replace(/<img[^>]*\salt=["']([^"']+)["'][^>]*>/gi, (_, alt) => ` ${alt} `)
    .replace(/<[^>]*\stitle=["']([^"']+)["'][^>]*>/gi, (_, t) => ` ${t} `)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export type ExtractedListing = {
  title: string;
  price: number;
  description: string;
  location: string;
  condition: string | null;
  category: string;
  subcategory: string | null;
  phone: string | null;
  vehicle: unknown;
  immo: unknown;
};

export type ExtractResult =
  | { ok: true; data: ExtractedListing; html: string }
  | { ok: false; error: string; html?: string };

/** Récupère une page HTML, échec gracieux. */
export async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Extrait une annonce depuis une URL — fetch + Claude.
 * `html` est renvoyé pour permettre des passes secondaires (extraction d'images).
 */
export async function extractListingFromUrl(url: string): Promise<ExtractResult> {
  const html = await fetchHtml(url);
  if (!html) return { ok: false, error: "Impossible de charger la page" };

  const text = stripHtml(html).slice(0, 80_000);
  const userContent = `Source : ${url}\n\n---\n${text}\n---`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userContent }],
    });
    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { ok: false, error: "Réponse Claude invalide", html };
    const data = JSON.parse(m[0]) as ExtractedListing;
    // Garde-fous post-extraction.
    if (typeof data.title === "string") data.title = data.title.slice(0, 200);
    return { ok: true, data, html };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur Claude";
    return { ok: false, error: msg, html };
  }
}

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return false;
  const role = (session.user as any)?.role;
  if (role === "ADMIN") return true;
  const db = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  return db?.role === "ADMIN";
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  }

  const { url } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL manquante" }, { status: 400 });
  }

  // Fetch the page
  let html = "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err: any) {
    return NextResponse.json({ error: `Impossible de charger la page : ${err.message}` }, { status: 422 });
  }

  // Strip heavy HTML — keep only text content, truncate to ~40k chars for Claude
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 40_000);

  const prompt = `Tu es un assistant qui extrait les informations d'une annonce immobilière ou de vente depuis le texte brut d'une page web.

Voici le texte extrait de la page : ${url}

---
${stripped}
---

Extrais toutes les informations disponibles et réponds UNIQUEMENT avec un objet JSON valide (pas de markdown, pas d'explication) avec ces champs (utilise null si l'information n'est pas disponible) :

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
- Ne génère RIEN d'autre que le JSON`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();

    // Extract JSON even if wrapped in backticks
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Réponse invalide de l'IA");

    const data = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: `Erreur IA : ${err.message}` }, { status: 500 });
  }
}

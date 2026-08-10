import { NextResponse } from "next/server";
import {
  PRO_SUGGEST_VERSION,
  matchProLeavesFromPrompt,
  searchProLeaves,
} from "@/lib/pro-catalog/suggest";

export const runtime = "nodejs";

const MAX_LIMIT = 25;
/** Au-delà, c'est un copier-coller : on tronque avant de tokeniser. */
const MAX_PROMPT = 4000;

/**
 * Autosuggestion de prestations PRO.
 *
 * - `?q=coupe+femme` : recherche tapée, tous les mots doivent matcher.
 * - `?prompt=<texte long>` : parcours « prompt libre », on renvoie les 3
 *   meilleures prestations pour pré-remplir le formulaire.
 *
 * Filtres communs : `domains=beaute,transport`, `categories=C01,C08`, `limit`.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const prompt = url.searchParams.get("prompt")?.trim().slice(0, MAX_PROMPT) ?? "";

  const options = {
    limit: parseLimit(url.searchParams.get("limit")),
    domains: splitList(url.searchParams.get("domains")),
    categoryIds: splitList(url.searchParams.get("categories")),
  };

  const results = prompt
    ? matchProLeavesFromPrompt(prompt, { ...options, limit: options.limit ?? 3 })
    : searchProLeaves(q, options);

  return NextResponse.json(
    { version: PRO_SUGGEST_VERSION, mode: prompt ? "prompt" : "query", count: results.length, results },
    // Une même frappe revient beaucoup pendant la saisie : un cache court suffit
    // à absorber les répétitions sans figer le référentiel.
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}

function parseLimit(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(n, MAX_LIMIT);
}

function splitList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

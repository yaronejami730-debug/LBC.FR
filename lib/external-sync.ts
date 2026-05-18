/**
 * Synchronisation d'une source externe → annonces Deal & Co.
 *
 * Dispatch par `kind` (un connecteur par site source). Pour l'instant : `bsk`
 * (BSK Immobilier — pages agent). Ajouter un connecteur = exporter une nouvelle
 * fonction `syncXxx` et l'enregistrer dans le `switch` de `syncSource`.
 */

import type { PrismaClient } from "@prisma/client";
import { extractListingFromUrl, fetchHtml } from "./external-extract";
import { extractImages } from "./external-images";
import { createExternalListing } from "./external-create";

export type SyncResult = {
  created: number;
  deduped: number;
  failed: number;
  total: number;
  details: string[]; // 1 ligne par annonce — agrégé dans `ExternalSource.lastResult`
};

const BSK_LISTING_RE = /https?:\/\/bskimmobilier\.com\/bien\/[^"'\s?#]+\/(\d+)/g;

/** Registre des connecteurs : domaine → kind. */
const CONNECTOR_RULES: { kind: string; matchHost: RegExp }[] = [
  { kind: "bsk", matchHost: /(^|\.)bskimmobilier\.com$/i },
];

/**
 * Détecte le connecteur à partir du hostname (sans www).
 * Renvoie `"generic"` si aucun connecteur dédié — le scraper générique prend
 * le relais (heuristiques d'extraction de liens d'annonces).
 */
export function detectKind(hostname: string): string {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return CONNECTOR_RULES.find((c) => c.matchHost.test(host))?.kind ?? "generic";
}

/**
 * Parse une URL en composants exploitables par le scraper.
 *   domain = hostname sans www
 *   agencySlug = 1er segment de path (ex. `paris-17`, `sylvie-mekil-8374`)
 *   baseUrl = URL complète originale (le scraper ne crawle QUE cette page,
 *             jamais le reste du domaine).
 */
export function parseSourceUrl(rawUrl: string): {
  domain: string;
  agencySlug: string | null;
  baseUrl: string;
  kind: string;
} | null {
  try {
    const u = new URL(rawUrl);
    const domain = u.hostname.replace(/^www\./, "").toLowerCase();
    const segs = u.pathname.split("/").filter(Boolean);
    return {
      domain,
      agencySlug: segs[0] ?? null,
      baseUrl: rawUrl,
      kind: detectKind(domain),
    };
  } catch {
    return null;
  }
}

/** Connecteur BSK Immobilier — pages agent. */
async function syncBsk(
  prisma: PrismaClient,
  source: { id: string; url: string; ownerId: string },
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, deduped: 0, failed: 0, total: 0, details: [] };

  const html = await fetchHtml(source.url);
  if (!html) {
    result.details.push("Impossible de charger la page source (timeout ou 4xx/5xx).");
    return result;
  }

  // Dédoublonne par ID numérique → une URL par annonce.
  const byId = new Map<string, string>();
  for (const m of html.matchAll(BSK_LISTING_RE)) {
    if (!byId.has(m[1])) byId.set(m[1], m[0]);
  }
  result.total = byId.size;
  if (byId.size === 0) {
    result.details.push("Aucune annonce détectée sur la page agent.");
    return result;
  }

  for (const [id, url] of byId) {
    const ext = await extractListingFromUrl(url);
    if (!ext.ok) {
      result.failed++;
      result.details.push(`bsk:${id} — extraction KO (${ext.error})`);
      continue;
    }
    const images = extractImages(ext.html, url);

    const r = await createExternalListing(
      prisma,
      source.ownerId,
      {
        externalId: `bsk:${id}`,
        sourceUrl: url,
        title: ext.data.title,
        description: ext.data.description,
        price: ext.data.price,
        category: ext.data.category,
        subcategory: ext.data.subcategory,
        location: ext.data.location,
        condition: ext.data.condition,
        images,
        phone: ext.data.phone,
        metadata: { vehicle: ext.data.vehicle, immo: ext.data.immo },
      },
      `source:${source.id.slice(0, 8)}`,
    );

    if (!r.ok) {
      result.failed++;
      result.details.push(`bsk:${id} — ${r.error}`);
    } else if (r.deduplicated) {
      result.deduped++;
      result.details.push(`bsk:${id} — déjà importé`);
    } else {
      result.created++;
      result.details.push(`bsk:${id} — créé (${r.status}, risk ${r.riskScore})`);
    }
  }
  return result;
}

/**
 * Connecteur générique — fonctionne sur n'importe quel site d'agence.
 *
 * 1. Charge la page source.
 * 2. Extrait les liens internes (même domaine) ressemblant à des annonces
 *    (heuristique de mots-clés dans le path : /bien, /annonce, /vente…).
 * 3. Extrait chaque annonce via Claude + images.
 *
 * Ne crawle QUE la page fournie — aucune exploration récursive du domaine.
 */
const LISTING_HINT_RE =
  /\/(biens?|annonces?|offres?|ventes?|locations?|propriet[eé]s?|produits?|maisons?|appartements?|lots?|ref|listings?|estate|property)([-/]|$)/i;

async function syncGeneric(
  prisma: PrismaClient,
  source: { id: string; url: string; ownerId: string },
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, deduped: 0, failed: 0, total: 0, details: [] };

  const html = await fetchHtml(source.url);
  if (!html) {
    result.details.push("Page source inaccessible (timeout ou 4xx/5xx).");
    return result;
  }

  let origin: string;
  let host: string;
  try {
    const u = new URL(source.url);
    origin = u.origin;
    host = u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    result.details.push("URL source invalide.");
    return result;
  }

  // Liens internes ressemblant à des annonces.
  const urls = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"'\s]+)["']/gi)) {
    let abs: URL;
    try {
      abs = new URL(m[1], origin);
    } catch {
      continue;
    }
    if (abs.hostname.replace(/^www\./, "").toLowerCase() !== host) continue; // même domaine
    if (abs.pathname.split("/").filter(Boolean).length < 2) continue; // pas une page liste
    if (!LISTING_HINT_RE.test(abs.pathname)) continue; // ressemble à une annonce
    urls.add(`${abs.origin}${abs.pathname}`);
  }

  const list = [...urls].slice(0, 60); // garde-fou
  result.total = list.length;
  if (list.length === 0) {
    result.details.push(
      "Aucune annonce détectée — vérifie que l'URL pointe vers la page listant les biens.",
    );
    return result;
  }

  for (const url of list) {
    const ext = await extractListingFromUrl(url);
    if (!ext.ok) {
      result.failed++;
      result.details.push(`${url} — extraction KO (${ext.error})`);
      continue;
    }
    const images = extractImages(ext.html, url);
    const externalId = `generic:${new URL(url).pathname}`;

    const r = await createExternalListing(
      prisma,
      source.ownerId,
      {
        externalId,
        sourceUrl: url,
        title: ext.data.title,
        description: ext.data.description,
        price: ext.data.price,
        category: ext.data.category,
        subcategory: ext.data.subcategory,
        location: ext.data.location,
        condition: ext.data.condition,
        images,
        phone: ext.data.phone,
        metadata: { vehicle: ext.data.vehicle, immo: ext.data.immo },
      },
      `source:${source.id.slice(0, 8)}`,
    );

    if (!r.ok) {
      result.failed++;
      result.details.push(`${url} — ${r.error}`);
    } else if (r.deduplicated) {
      result.deduped++;
      result.details.push(`${url} — déjà importé`);
    } else {
      result.created++;
      result.details.push(`${url} — créé (${r.status})`);
    }
  }
  return result;
}

/** Point d'entrée dispatch. Connecteur dédié si dispo, sinon générique. */
export async function syncSource(
  prisma: PrismaClient,
  source: { id: string; ownerId: string; url: string; kind: string },
): Promise<SyncResult> {
  switch (source.kind) {
    case "bsk":
      return syncBsk(prisma, source);
    default:
      return syncGeneric(prisma, source);
  }
}

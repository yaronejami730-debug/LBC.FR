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

/** Point d'entrée dispatch. */
export async function syncSource(
  prisma: PrismaClient,
  source: { id: string; ownerId: string; url: string; kind: string },
): Promise<SyncResult> {
  switch (source.kind) {
    case "bsk":
      return syncBsk(prisma, source);
    default:
      return {
        created: 0,
        deduped: 0,
        failed: 0,
        total: 0,
        details: [`Kind '${source.kind}' non supporté.`],
      };
  }
}

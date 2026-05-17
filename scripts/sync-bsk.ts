/**
 * Synchronise les annonces d'un agent BSK Immobilier vers Deal & Co.
 *
 * Pipeline :
 *   1. Récupère la page agent (HTML server-rendered).
 *   2. Extrait les URLs d'annonces `/bien/.../<id>`.
 *   3. Pour chaque ID inconnu, fetch détail → extraction Claude + images.
 *   4. POST sur `/api/external/listings` avec idempotence (`externalId=bsk:<id>`).
 *
 * Usage :
 *   npx tsx scripts/sync-bsk.ts <agentUrl> <apiKey>
 *
 * Exemple :
 *   npx tsx scripts/sync-bsk.ts https://bskimmobilier.com/sylvie-mekil-8374 dco_abcd_...
 *
 * `NEXTAUTH_URL` doit pointer sur l'instance Deal & Co cible (défaut localhost).
 */
import "./load-env";
import { extractListingFromUrl, fetchHtml } from "../lib/external-extract";
import { extractImages } from "../lib/external-images";

const BSK_LISTING_RE = /https?:\/\/bskimmobilier\.com\/bien\/[^"'\s?#]+\/(\d+)/g;

async function main() {
  const [agentUrl, apiKey] = process.argv.slice(2);
  if (!agentUrl || !apiKey) {
    console.error("Usage : tsx scripts/sync-bsk.ts <agentUrl> <apiKey>");
    process.exit(1);
  }

  const target = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  console.log(`Source  : ${agentUrl}`);
  console.log(`Cible   : ${target}/api/external/listings\n`);

  const agentHtml = await fetchHtml(agentUrl);
  if (!agentHtml) {
    console.error("✗ Impossible de charger la page agent.");
    process.exit(1);
  }

  // Dédoublonne par ID numérique → on garde une seule URL par annonce.
  const byId = new Map<string, string>();
  for (const m of agentHtml.matchAll(BSK_LISTING_RE)) {
    const id = m[1];
    if (!byId.has(id)) byId.set(id, m[0]);
  }
  console.log(`Annonces détectées : ${byId.size}\n`);

  let created = 0;
  let deduped = 0;
  let failed = 0;

  for (const [id, url] of byId) {
    process.stdout.write(`  bsk:${id} … `);
    const ext = await extractListingFromUrl(url);
    if (!ext.ok) {
      console.log(`✗ extraction (${ext.error})`);
      failed++;
      continue;
    }

    const images = extractImages(ext.html, url);

    const payload = {
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
    };

    try {
      const res = await fetch(`${target}/api/external/listings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        console.log(`✗ HTTP ${res.status} (${json.error ?? "erreur"})`);
        failed++;
      } else if (json.deduplicated) {
        console.log(`= déjà importé (listing ${json.listingId})`);
        deduped++;
      } else {
        console.log(`✓ ${json.status} risk=${json.riskScore}`);
        created++;
      }
    } catch (err) {
      console.log(`✗ réseau (${err instanceof Error ? err.message : "erreur"})`);
      failed++;
    }
  }

  console.log(
    `\nCréés : ${created} · Déjà importés : ${deduped} · Échecs : ${failed} · Total : ${byId.size}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Synchronisation d'une source externe → annonces Deal & Co.
 *
 * Dispatch par `kind` (un connecteur par site source). Pour l'instant : `bsk`
 * (BSK Immobilier — pages agent). Ajouter un connecteur = exporter une nouvelle
 * fonction `syncXxx` et l'enregistrer dans le `switch` de `syncSource`.
 *
 * ── Détection de disparition ────────────────────────────────────────────────
 * Un re-scrape qui ne revoit plus l'`externalId` d'une annonce déjà importée
 * est un signal complémentaire à `lib/external-revalidate.ts` (qui vérifie
 * chaque annonce individuellement via son `sourceUrl`) : ici, c'est la page
 * de listing de la source elle-même qui ne mentionne plus le bien. Même
 * prudence que partout ailleurs dans ce projet : jamais de retrait sur un
 * seul passage manqué (`missingFromSourceStreak`, cf. `detectDisappeared`),
 * et jamais de détection du tout si le scrape ramène trop peu d'annonces par
 * rapport à ce qui est connu (page cassée plutôt que disparition de masse).
 */

import type { PrismaClient } from "@prisma/client";
import { extractListingFromUrl, fetchHtml } from "./external-extract";
import { extractImages } from "./external-images";
import { createExternalListing } from "./external-create";
import { removeListing } from "./moderation/removal";
import { onListingRemoved } from "./seo/lifecycle";

export type SyncResult = {
  created: number;
  deduped: number;
  failed: number;
  total: number;
  disappeared: number; // annonces retirées faute de réapparaître dans le scrape (cf. `detectDisappeared`)
  details: string[]; // 1 ligne par annonce — agrégé dans `ExternalSource.lastResult`
};

/**
 * Nombre de passages consécutifs sans revoir l'externalId avant de traiter
 * l'annonce comme disparue. Aligné sur `FAILURE_THRESHOLD` d'
 * `external-revalidate.ts` : un aléa isolé (pagination, tri changé, page
 * partiellement chargée) ne doit jamais suffire à lui seul.
 */
const MISSING_STREAK_THRESHOLD = 3;

/**
 * Couverture minimale (scrapé / connu) en dessous de laquelle on suppose que
 * la page source est cassée plutôt que le stock réellement écoulé. Sous ce
 * seuil, la détection de disparition est entièrement sautée pour ce passage
 * — aucun compteur ne progresse, y compris pour les annonces réellement
 * absentes : mieux vaut un cycle de retard qu'un retrait de masse sur un
 * incident de scraping.
 */
const MIN_PLAUSIBLE_COVERAGE = 0.5;

/** Fusionne des clés dans `metadata` (colonne `String`) sans écraser le reste. */
function mergeMeta(current: Record<string, unknown>, patch: Record<string, unknown>): string {
  return JSON.stringify({ ...current, ...patch });
}

/**
 * Compare les `externalId` vus lors du scrape à ceux déjà importés pour cette
 * source, et fait progresser (ou retombe à zéro) le compteur d'absences
 * consécutives de chaque annonce manquante.
 *
 * Portée du "déjà importé pour cette source" : le compte propriétaire + le
 * préfixe de kind (`bsk:` / `generic:`) + le même hostname que `source.url`
 * (lu dans `metadata.sourceUrl`). Cette dernière condition évite de mélanger
 * deux sources de même kind appartenant au même compte — imparfait si deux
 * pages du même domaine listent des biens disjoints (pas de FK Listing →
 * ExternalSource pour trancher plus finement), mais c'est la seule
 * granularité disponible sans modifier le schéma d'import existant.
 */
async function detectDisappeared(
  prisma: PrismaClient,
  source: { id: string; ownerId: string; url: string },
  kindPrefix: string,
  scrapedIds: ReadonlySet<string>,
): Promise<{ disappeared: number; details: string[] }> {
  const details: string[] = [];
  let domain: string | null = null;
  try {
    domain = new URL(source.url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    domain = null;
  }

  const rows = await prisma.listing.findMany({
    where: {
      userId: source.ownerId,
      status: "APPROVED",
      deletedAt: null,
      metadata: { contains: `"externalId":"${kindPrefix}` },
    },
    select: { id: true, title: true, metadata: true },
  });

  type Known = { id: string; title: string; externalId: string; meta: Record<string, unknown> };
  const known: Known[] = [];
  for (const r of rows) {
    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(r.metadata || "{}") as Record<string, unknown>;
    } catch {
      continue;
    }
    const eid = typeof meta.externalId === "string" ? meta.externalId : null;
    if (!eid || !eid.startsWith(kindPrefix)) continue;
    if (domain) {
      const su = typeof meta.sourceUrl === "string" ? meta.sourceUrl : "";
      try {
        if (new URL(su).hostname.replace(/^www\./, "").toLowerCase() !== domain) continue;
      } catch {
        continue; // sourceUrl illisible : impossible de confirmer l'appartenance à cette source, on ignore par prudence
      }
    }
    known.push({ id: r.id, title: r.title, externalId: eid, meta });
  }

  if (known.length === 0) return { disappeared: 0, details };

  // Garde-fou de plausibilité — voir MIN_PLAUSIBLE_COVERAGE.
  if (scrapedIds.size < known.length * MIN_PLAUSIBLE_COVERAGE) {
    details.push(
      `Détection de disparition ignorée : scrape ${scrapedIds.size}/${known.length} annonces connues (page probablement cassée).`,
    );
    return { disappeared: 0, details };
  }

  let disappeared = 0;
  for (const row of known) {
    const present = scrapedIds.has(row.externalId);
    const prevStreak =
      typeof row.meta.missingFromSourceStreak === "number" ? row.meta.missingFromSourceStreak : 0;

    if (present) {
      if (prevStreak > 0) {
        await prisma.listing
          .update({ where: { id: row.id }, data: { metadata: mergeMeta(row.meta, { missingFromSourceStreak: 0 }) } })
          .catch(() => {});
      }
      continue;
    }

    const streak = prevStreak + 1;
    if (streak < MISSING_STREAK_THRESHOLD) {
      await prisma.listing
        .update({ where: { id: row.id }, data: { metadata: mergeMeta(row.meta, { missingFromSourceStreak: streak }) } })
        .catch(() => {});
      details.push(`${row.externalId} — absente du scrape (${streak}/${MISSING_STREAK_THRESHOLD}), conservée.`);
      continue;
    }

    // Absente depuis MISSING_STREAK_THRESHOLD passages consécutifs : retrait
    // réversible (21 j) — jamais une purge directe, jamais SOLD (on ne sait
    // pas ici si le bien est vendu ou seulement dépublié de la page liste).
    const reason = `Absente de la page source lors des ${streak} derniers passages du connecteur.`;
    await removeListing({ listingId: row.id, reason, actor: "cron:external-sync" });
    await onListingRemoved(row.id);
    disappeared++;
    details.push(`${row.externalId} — ${reason}`);
  }

  return { disappeared, details };
}

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
  const result: SyncResult = { created: 0, deduped: 0, failed: 0, total: 0, disappeared: 0, details: [] };

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

  // Le scrape a réussi et ramené un lot non vide (garde déjà passée ci-dessus) :
  // on peut comparer aux annonces déjà connues pour cette source.
  const scrapedIds = new Set([...byId.keys()].map((id) => `bsk:${id}`));
  const disappearance = await detectDisappeared(prisma, source, "bsk:", scrapedIds);
  result.disappeared = disappearance.disappeared;
  result.details.push(...disappearance.details);

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
  const result: SyncResult = { created: 0, deduped: 0, failed: 0, total: 0, disappeared: 0, details: [] };

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

  // Même logique que le connecteur bsk : le scrape a réussi et ramené un lot
  // non vide, on peut comparer aux annonces déjà connues pour cette source.
  const scrapedIds = new Set([...list].map((u) => `generic:${new URL(u).pathname}`));
  const disappearance = await detectDisappeared(prisma, source, "generic:", scrapedIds);
  result.disappeared = disappearance.disappeared;
  result.details.push(...disappearance.details);

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

/**
 * File d'indexation — construction et synchronisation.
 *
 * Le principe tient en une phrase : **la file décrit le même univers que le
 * sitemap, plus tout ce que le sitemap a écarté et pourquoi.**
 *
 * L'écran « 362 en attente / 0 soumise » n'était pas une file : c'était le
 * décompte des `<loc>` du sitemap, lu par un outil externe qui ne pouvait rien
 * en faire. Aucun état n'existait côté produit, donc aucune question n'avait de
 * réponse : pourquoi cette annonce n'est-elle pas indexée, qu'est-ce qui lui
 * manque, Google l'a-t-il seulement vue.
 *
 * Ce module produit cet état. Il ne « pousse » rien vers Google — c'est
 * impossible, l'Indexing API ne couvre que `JobPosting` et `BroadcastEvent`. Il
 * fait ce qui est réellement en notre pouvoir : décider quelles URL méritent
 * d'être recommandées, les recommander proprement, et enregistrer ce que Google
 * en fait ensuite.
 */

import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { FRENCH_CITIES } from "@/lib/cities";
import { getAllArticles } from "@/lib/blog";
import { getSeoInventory, isIndexable } from "@/lib/seo/inventory";
import { getEditorialEligibility } from "@/lib/seo/editorial";
import { getIndexablePriceSlugs } from "@/lib/seo/price";
import { STATIC_PAGES } from "@/lib/seo/static-routes";
import { priorityBand, type ExclusionReason } from "@/lib/seo/indexability";

export const BASE = "https://www.dealandcompany.fr";

export type SeoUrlType =
  | "LISTING"
  | "CATEGORY"
  | "SUBCATEGORY"
  | "CITY"
  | "CATEGORY_CITY"
  | "BRAND"
  | "PRO"
  | "EDITORIAL"
  | "BLOG"
  | "STATIC";

/**
 * Statuts de la file.
 *
 * Les trois premiers sont les nôtres — nous les décidons et nous en répondons.
 * Les suivants viennent de Google, en lecture seule, via l'API URL Inspection.
 * Ne jamais écrire un statut Google sans l'avoir lu chez Google : une file qui
 * affiche « indexée » parce qu'elle l'espère ne sert à rien.
 */
export type SeoUrlStatus =
  | "PENDING"
  | "ELIGIBLE"
  | "EXCLUDED"
  | "SUBMITTED"
  | "DISCOVERED"
  | "CRAWLED"
  | "INDEXED"
  | "NOT_INDEXED"
  | "ERROR"
  | "GONE";

export type QueueEntry = {
  url: string;
  path: string;
  type: SeoUrlType;
  entityId: string | null;
  score: number;
  indexable: boolean;
  reasons: ExclusionReason[];
  inSitemap: boolean;
  contentUpdatedAt: Date | null;
};

/**
 * Univers complet des URL publiques connues, avec leur verdict.
 *
 * Lit exactement les mêmes sources que `app/sitemap.ts`. Si les deux devaient
 * un jour diverger, c'est ici qu'il faudrait corriger — pas en ajoutant une
 * troisième règle ailleurs.
 */
export async function buildQueueEntries(): Promise<QueueEntry[]> {
  const [inv, editorial, priceSlugs] = await Promise.all([
    getSeoInventory(),
    getEditorialEligibility(),
    getIndexablePriceSlugs(),
  ]);

  const entries: QueueEntry[] = [];
  const push = (e: QueueEntry) => entries.push(e);

  // Pages permanentes — toujours éligibles, elles ne dépendent d'aucun stock.
  for (const page of STATIC_PAGES) {
    const path = page.path;
    push({
      url: path === "/" ? BASE : `${BASE}${path}`,
      path,
      type: "STATIC",
      entityId: null,
      score: Math.round(page.priority * 100),
      indexable: true,
      reasons: [],
      inSitemap: true,
      contentUpdatedAt: null,
    });
  }

  for (const article of getAllArticles()) {
    push({
      url: `${BASE}/blog/${article.slug}`,
      path: `/blog/${article.slug}`,
      type: "BLOG",
      entityId: article.slug,
      score: 80,
      indexable: true,
      reasons: [],
      inSitemap: true,
      contentUpdatedAt: new Date(article.updatedAt),
    });
  }

  // Éditorial : `getEditorialEligibility` ne renvoie que ce qui répond 200.
  const editorialFamilies: Array<[string, string[]]> = [
    ["comparatif", editorial.comparatif],
    ["voiture", editorial.clusters],
    ["voiture-budget", editorial.budgets],
  ];
  // Les pages de cote sont éditoriales au même titre : leur éligibilité tient à
  // la solidité de la cote, jamais au stock (`lib/seo/price.ts`).
  editorialFamilies.push(["prix", priceSlugs]);

  for (const [prefix, slugs] of editorialFamilies) {
    for (const slug of slugs) {
      push({
        url: `${BASE}/${prefix}/${slug}`,
        path: `/${prefix}/${slug}`,
        type: "EDITORIAL",
        entityId: slug,
        score: 70,
        indexable: true,
        reasons: [],
        inSitemap: true,
        contentUpdatedAt: inv.total > 0 ? inv.lastModified : null,
      });
    }
  }

  // Pages de liste. Celles qui n'atteignent pas le seuil entrent quand même
  // dans la file, en EXCLUDED : c'est précisément ce qu'on veut voir sur le
  // tableau de bord — « cette page est à une annonce de basculer ».
  //
  // Le verdict d'une page ville × catégorie ne vient **pas** de `isIndexable` :
  // il est précalculé par l'inventaire, seuils plus hauts et hystérésis
  // comprises (`lib/seo/city-category.ts`). C'est aussi cette table que la
  // synchro réécrit dans `SeoUrl.indexable` — donc l'état que l'instantané
  // suivant relira comme « état précédent ». La boucle est fermée ici, et
  // nulle part ailleurs.
  const listBuckets: Array<[SeoUrlType, Record<string, number>, (key: string) => string | null]> = [
    ["CATEGORY", inv.byCategory, (id) => (CATEGORIES.some((c) => c.id === id) ? `/annonces/${id}` : null)],
    ["SUBCATEGORY", inv.byCategorySub, (key) => `/annonces/${key}`],
    ["CATEGORY_CITY", inv.byCategoryCity, (key) => `/annonces/${key}`],
    ["CATEGORY_CITY", inv.byCategorySubCity, (key) => `/annonces/${key}`],
    ["BRAND", inv.byBrand, (slug) => `/annonces/vehicules/${slug}`],
    ["BRAND", inv.byBrandModel, (key) => `/annonces/vehicules/${key}`],
  ];

  for (const [type, bucket, toPath] of listBuckets) {
    for (const [key, count] of Object.entries(bucket)) {
      const path = toPath(key);
      if (!path) continue;
      const eligible =
        type === "CATEGORY_CITY"
          ? (inv.cityCategoryIndexable[key] ?? false)
          : isIndexable(count);
      push({
        url: `${BASE}${path}`,
        path,
        type,
        entityId: key,
        // Le score d'une page de liste suit son stock : 3 annonces valent 50,
        // 30 valent 90. Au-delà, l'apport marginal d'une annonce de plus est nul.
        score: listScore(count),
        indexable: eligible,
        reasons: eligible ? [] : (["QUALITE_INSUFFISANTE"] as ExclusionReason[]),
        inSitemap: eligible,
        contentUpdatedAt: inv.total > 0 ? inv.lastModified : null,
      });
    }
  }

  const knownCities = new Set(FRENCH_CITIES.map((c) => c.slug));
  for (const [slug, count] of Object.entries(inv.byCity)) {
    if (!knownCities.has(slug)) continue;
    const eligible = isIndexable(count);
    push({
      url: `${BASE}/ville/${slug}`,
      path: `/ville/${slug}`,
      type: "CITY",
      entityId: slug,
      score: listScore(count),
      indexable: eligible,
      reasons: eligible ? [] : (["QUALITE_INSUFFISANTE"] as ExclusionReason[]),
      inSitemap: eligible,
      contentUpdatedAt: inv.total > 0 ? inv.lastModified : null,
    });
  }

  for (const pro of inv.proProfiles) {
    push({
      url: `${BASE}${pro.path}`,
      path: pro.path,
      type: "PRO",
      entityId: pro.path.replace("/pro/", ""),
      score: pro.score,
      indexable: true,
      reasons: [],
      inSitemap: true,
      contentUpdatedAt: pro.lastModified,
    });
  }

  for (const listing of inv.listings) {
    push({
      url: `${BASE}${listing.path}`,
      path: listing.path,
      type: "LISTING",
      entityId: listing.path.split("/")[2] ?? null,
      score: listing.score,
      indexable: true,
      reasons: [],
      inSitemap: true,
      contentUpdatedAt: listing.lastModified,
    });
  }

  // Les annonces écartées entrent dans la file avec leur motif. C'est la
  // réponse à « pourquoi cette page n'est-elle pas dans Google » — la question
  // à laquelle l'ancien écran ne savait pas répondre.
  for (const excluded of inv.excluded) {
    push({
      url: `${BASE}${excluded.path}`,
      path: excluded.path,
      type: "LISTING",
      entityId: excluded.id,
      score: excluded.score,
      indexable: false,
      reasons: excluded.reasons,
      inSitemap: false,
      contentUpdatedAt: null,
    });
  }

  // Dédoublonnage : `byCategorySubCity` et `byCategoryCity` peuvent produire la
  // même URL sur certaines combinaisons. On garde la première occurrence, qui
  // porte le type le plus spécifique.
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });
}

/** Score d'une page de liste, borné : 3 annonces → 50, 30+ → 90. */
function listScore(count: number): number {
  if (count <= 0) return 10;
  if (count < 3) return 30;
  return Math.min(90, 50 + Math.round((Math.min(count, 30) - 3) * (40 / 27)));
}

export type SyncSummary = {
  total: number;
  created: number;
  updated: number;
  gone: number;
  eligible: number;
  excluded: number;
  averageScore: number;
  byType: Record<string, number>;
  byExclusion: Record<string, number>;
};

/**
 * Synchronise la table `SeoUrl` avec l'univers courant.
 *
 * Traitement par lots : une transaction unique sur plusieurs milliers d'`upsert`
 * tiendrait un verrou trop longtemps sur une base Neon mutualisée, et une seule
 * ligne en échec annulerait tout le passage. Chaque lot est indépendant, donc
 * une erreur ponctuelle ne coûte que son lot — le suivant repart.
 *
 * Les statuts venus de Google (`discoveredAt`, `indexedAt`, `coverageState`) ne
 * sont **jamais** écrasés ici : cette fonction ne parle que de notre verdict à
 * nous. Seul `syncInspection` a le droit d'y toucher.
 */
export async function syncQueue(batchSize = 200): Promise<SyncSummary> {
  const entries = await buildQueueEntries();
  const now = new Date();

  const summary: SyncSummary = {
    total: entries.length,
    created: 0,
    updated: 0,
    gone: 0,
    eligible: 0,
    excluded: 0,
    averageScore: 0,
    byType: {},
    byExclusion: {},
  };

  const existing = await prisma.seoUrl.findMany({ select: { url: true, status: true } });
  const existingByUrl = new Map(existing.map((row) => [row.url, row.status]));

  let scoreSum = 0;

  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const batch = entries.slice(offset, offset + batchSize);

    await Promise.all(
      batch.map(async (entry) => {
        const previousStatus = existingByUrl.get(entry.url);
        const status = nextStatus(entry, previousStatus);

        const shared = {
          path: entry.path,
          type: entry.type,
          entityId: entry.entityId,
          score: entry.score,
          priorityBand: priorityBand(entry.score, entry.indexable),
          indexable: entry.indexable,
          exclusionReasons: JSON.stringify(entry.reasons),
          inSitemap: entry.inSitemap,
          status,
          contentUpdatedAt: entry.contentUpdatedAt,
        };

        await prisma.seoUrl.upsert({
          where: { url: entry.url },
          create: { url: entry.url, ...shared },
          update: shared,
        });
      }),
    );

    for (const entry of batch) {
      scoreSum += entry.score;
      summary.byType[entry.type] = (summary.byType[entry.type] ?? 0) + 1;
      if (entry.indexable) summary.eligible++;
      else summary.excluded++;
      for (const reason of entry.reasons) {
        summary.byExclusion[reason] = (summary.byExclusion[reason] ?? 0) + 1;
      }
      if (existingByUrl.has(entry.url)) summary.updated++;
      else summary.created++;
    }

    console.log(
      `[SEO][queue] lot ${offset / batchSize + 1} — ${batch.length} URL traitées ` +
        `(${summary.eligible} éligibles, ${summary.excluded} exclues à ce stade)`,
    );
  }

  // URL disparues de l'univers : annonce supprimée, ville tombée sous le seuil,
  // page éditoriale sans stock. On ne détruit pas la ligne — l'historique de ce
  // que Google en savait a de la valeur — on la marque simplement close.
  const liveUrls = new Set(entries.map((e) => e.url));
  const stale = existing.filter((row) => !liveUrls.has(row.url) && row.status !== "GONE");

  for (let offset = 0; offset < stale.length; offset += batchSize) {
    const batch = stale.slice(offset, offset + batchSize);
    const result = await prisma.seoUrl.updateMany({
      where: { url: { in: batch.map((r) => r.url) } },
      data: { status: "GONE", indexable: false, inSitemap: false, updatedAt: now },
    });
    summary.gone += result.count;
  }

  summary.averageScore = entries.length ? Math.round(scoreSum / entries.length) : 0;

  console.log(
    `[SEO][queue] terminé — ${summary.total} URL : ${summary.eligible} éligibles, ` +
      `${summary.excluded} exclues, ${summary.gone} retirées, score moyen ${summary.averageScore}`,
  );

  return summary;
}

/**
 * Statut à écrire, en préservant ce que Google nous a déjà appris.
 *
 * Une URL constatée INDEXED reste INDEXED tant qu'elle demeure éligible : ce
 * n'est pas à la synchro locale de la rétrograder, elle n'en sait rien. En
 * revanche une URL devenue inéligible repasse sous notre verdict — nous venons
 * de demander à Google de la retirer, l'ancien état ne vaut plus.
 */
function nextStatus(entry: QueueEntry, previous: string | undefined): SeoUrlStatus {
  if (!entry.indexable) return "EXCLUDED";
  const googleStates: SeoUrlStatus[] = ["DISCOVERED", "CRAWLED", "INDEXED", "NOT_INDEXED"];
  if (previous && googleStates.includes(previous as SeoUrlStatus)) {
    return previous as SeoUrlStatus;
  }
  if (previous === "SUBMITTED") return "SUBMITTED";
  return "ELIGIBLE";
}

/** Délai au-delà duquel une exécution non terminée est réputée morte. */
const LOCK_TTL_MS = 15 * 60 * 1000;

/**
 * Verrou coopératif : empêche deux passages simultanés du même travail.
 *
 * Deux crons qui se chevauchent écriraient les mêmes lignes en concurrence et
 * produiraient un décompte faux. Renvoie `null` quand un passage est déjà en
 * cours et récent.
 */
export async function acquireJobLock(job: string): Promise<string | null> {
  const running = await prisma.seoJobRun.findFirst({
    where: { job, finishedAt: null, startedAt: { gt: new Date(Date.now() - LOCK_TTL_MS) } },
    orderBy: { startedAt: "desc" },
  });
  if (running) {
    console.log(`[SEO][${job}] passage ignoré — exécution déjà en cours depuis ${running.startedAt.toISOString()}`);
    return null;
  }
  const run = await prisma.seoJobRun.create({ data: { job } });
  console.log(`[SEO][${job}] démarrage — run ${run.id}`);
  return run.id;
}

export async function releaseJobLock(
  runId: string,
  outcome: { ok: boolean; processed: number; summary: unknown; error?: string },
): Promise<void> {
  await prisma.seoJobRun.update({
    where: { id: runId },
    data: {
      finishedAt: new Date(),
      ok: outcome.ok,
      processed: outcome.processed,
      summaryJson: JSON.stringify(outcome.summary ?? {}),
      error: outcome.error ?? null,
    },
  });
}

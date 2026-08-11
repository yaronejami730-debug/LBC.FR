/**
 * Relevé de l'état d'indexation réel, via l'API URL Inspection.
 *
 * Ce module est le seul endroit du code autorisé à écrire les statuts
 * DISCOVERED / CRAWLED / INDEXED / NOT_INDEXED dans `SeoUrl`. La règle est
 * volontairement rigide : un tableau de bord qui affiche « indexée » sans
 * l'avoir lu chez Google est pire que pas de tableau de bord, parce qu'on
 * cesse de chercher.
 *
 * Ce que l'API permet, et ce qu'elle ne permet pas :
 *
 *   ✔ lire ce que Google sait d'une URL — vue, explorée, indexée, canonique
 *     retenue, date de dernière exploration, sitemaps référents ;
 *   ✘ demander, accélérer ou garantir l'indexation. Aucune API publique ne le
 *     fait pour du contenu généraliste. L'Indexing API est réservée à
 *     `JobPosting` et `BroadcastEvent` ; s'en servir ailleurs expose la
 *     propriété à une suspension.
 *
 * Quotas : 2 000 requêtes par jour et 600 par minute et par propriété. Le
 * traitement s'arrête net à `DAILY_BUDGET` et espace ses appels.
 */

import { prisma } from "@/lib/prisma";
import { inspectUrl, SITE_URL } from "@/lib/seo/search-console";
import type { SeoUrlStatus } from "@/lib/seo/queue";

/**
 * Volume traité par passage. En deçà du quota journalier de 2 000, pour laisser
 * de la marge aux vérifications manuelles depuis Search Console.
 */
const DAILY_BUDGET = 150;

/** Pause entre deux appels — reste très loin du plafond de 600/minute. */
const DELAY_MS = 250;

/** Une URL déjà relevée n'est réinterrogée qu'après ce délai. */
const RECHECK_AFTER_DAYS = 7;

export type InspectionSummary = {
  inspected: number;
  indexed: number;
  crawledNotIndexed: number;
  discoveredNotIndexed: number;
  excludedByGoogle: number;
  errors: number;
  /** Décompte brut des `coverageState`, mot pour mot. */
  coverage: Record<string, number>;
  /** Écarts entre notre canonique et celle retenue par Google. */
  canonicalMismatches: number;
  skippedReason?: string;
};

/**
 * Traduit le verdict de Google en statut de file.
 *
 * On conserve `coverageState` brut à côté : la traduction sert au filtrage,
 * le texte d'origine sert au diagnostic, et il est plus précis que n'importe
 * quelle catégorie que nous inventerions.
 */
function toStatus(coverageState: string | null, verdict: string | null): SeoUrlStatus {
  const state = (coverageState ?? "").toLowerCase();
  if (state.includes("submitted and indexed") || state.includes("indexed, not submitted")) {
    return "INDEXED";
  }
  if (state.includes("crawled - currently not indexed") || state.includes("crawled")) {
    return "CRAWLED";
  }
  if (state.includes("discovered")) return "DISCOVERED";
  if (state) return "NOT_INDEXED";
  return verdict === "PASS" ? "INDEXED" : "NOT_INDEXED";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Relève l'état d'un lot d'URL, les plus prioritaires d'abord.
 *
 * Ordre de passage : jamais relevées avant tout, puis les plus anciennes, et à
 * l'intérieur de chaque groupe les scores les plus hauts. Une nouvelle annonce
 * à 88 passe donc avant une page de catégorie relevée la semaine dernière.
 */
export async function runInspectionBatch(limit = DAILY_BUDGET): Promise<InspectionSummary> {
  const summary: InspectionSummary = {
    inspected: 0,
    indexed: 0,
    crawledNotIndexed: 0,
    discoveredNotIndexed: 0,
    excludedByGoogle: 0,
    errors: 0,
    coverage: {},
    canonicalMismatches: 0,
  };

  if (!SITE_URL || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    summary.skippedReason =
      "SEARCH_CONSOLE_SITE_URL ou GOOGLE_SERVICE_ACCOUNT_KEY absent — relevé impossible";
    console.log(`[SEO][inspection] ignoré : ${summary.skippedReason}`);
    return summary;
  }

  const staleBefore = new Date(Date.now() - RECHECK_AFTER_DAYS * 86_400_000);

  const candidates = await prisma.seoUrl.findMany({
    where: {
      indexable: true,
      status: { not: "GONE" },
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: staleBefore } }],
    },
    orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }, { score: "desc" }],
    take: Math.min(limit, DAILY_BUDGET),
    select: { id: true, url: true, canonical: true },
  });

  console.log(`[SEO][inspection] ${candidates.length} URL à relever`);

  for (const candidate of candidates) {
    try {
      const result = await inspectUrl(candidate.url);
      const status = toStatus(result.coverageState, result.verdict);

      const coverageKey = result.coverageState ?? "inconnu";
      summary.coverage[coverageKey] = (summary.coverage[coverageKey] ?? 0) + 1;

      if (status === "INDEXED") summary.indexed++;
      else if (status === "CRAWLED") summary.crawledNotIndexed++;
      else if (status === "DISCOVERED") summary.discoveredNotIndexed++;
      else summary.excludedByGoogle++;

      const mismatch =
        !!result.googleCanonical &&
        !!result.userCanonical &&
        result.googleCanonical !== result.userCanonical;
      if (mismatch) summary.canonicalMismatches++;

      await prisma.seoUrl.update({
        where: { id: candidate.id },
        data: {
          status,
          coverageState: result.coverageState,
          googleCanonical: result.googleCanonical,
          canonical: result.userCanonical ?? candidate.canonical,
          // Une URL explorée a nécessairement été découverte avant : on date la
          // découverte au premier relevé qui l'atteste, sans jamais l'inventer.
          discoveredAt: status === "PENDING" ? null : new Date(),
          indexedAt: status === "INDEXED" ? new Date() : null,
          lastCheckedAt: new Date(),
          lastError: null,
          attempts: { increment: 1 },
        },
      });

      summary.inspected++;
    } catch (err) {
      summary.errors++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[SEO][inspection] échec ${candidate.url} : ${message}`);

      await prisma.seoUrl.update({
        where: { id: candidate.id },
        data: {
          lastError: message.slice(0, 500),
          lastCheckedAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      // Quota épuisé ou API désactivée : inutile d'insister sur tout le lot.
      if (message.includes("quota") || message.includes("has not been used")) {
        summary.skippedReason = message.slice(0, 200);
        console.error("[SEO][inspection] arrêt anticipé — " + summary.skippedReason);
        break;
      }
    }

    await sleep(DELAY_MS);
  }

  console.log(
    `[SEO][inspection] terminé — ${summary.inspected} relevées : ${summary.indexed} indexées, ` +
      `${summary.crawledNotIndexed} explorées non indexées, ${summary.discoveredNotIndexed} découvertes non explorées, ` +
      `${summary.errors} erreurs`,
  );

  return summary;
}

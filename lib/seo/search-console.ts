/**
 * Client Google Search Console — données SEO pour l'IA SEO.
 *
 * Pourquoi : Search Console expose ce que Google « sait » de nos pages —
 * requêtes tapées par les internautes, impressions, clics, CTR, position.
 * C'est la matière première de l'optimisation : on détecte les tendances de
 * recherche, on comprend l'intention, on enrichit les catégories et on repère
 * les mots-clés émergents avant la concurrence.
 *
 * Auth : compte de service (service account). Pas de consentement navigateur,
 * pas de refresh token — la clé JSON est dans GOOGLE_SERVICE_ACCOUNT_KEY.
 * L'email du compte de service doit être ajouté comme utilisateur de la
 * propriété dans Search Console, sinon l'API renvoie 403.
 */

import { google } from "googleapis";
import type { webmasters_v3, searchconsole_v1 } from "googleapis";

/** Scope lecture seule — on ne fait que consommer la donnée. */
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

/**
 * URL de la propriété Search Console. Deux formes possibles :
 *   - propriété domaine  : "sc-domain:exemple.fr"
 *   - propriété préfixe  : "https://exemple.fr/"
 * Configurable via SEARCH_CONSOLE_SITE_URL.
 */
export const SITE_URL = process.env.SEARCH_CONSOLE_SITE_URL ?? "";

let cachedClient: webmasters_v3.Webmasters | null = null;

/** Construit (et met en cache) le client Webmasters authentifié. */
export function getSearchConsole(): webmasters_v3.Webmasters {
  if (cachedClient) return cachedClient;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY manquant");
  }

  let credentials: { client_email: string; private_key: string };
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY n'est pas un JSON valide");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [SCOPE],
  });

  cachedClient = google.webmasters({ version: "v3", auth });
  return cachedClient;
}

let cachedInspector: searchconsole_v1.Searchconsole | null = null;

/** Client Search Console v1 — porte l'API URL Inspection. */
function getInspector(): searchconsole_v1.Searchconsole {
  if (cachedInspector) return cachedInspector;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY manquant");

  let credentials: { client_email: string; private_key: string };
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY n'est pas un JSON valide");
  }

  const auth = new google.auth.GoogleAuth({ credentials, scopes: [SCOPE] });
  cachedInspector = google.searchconsole({ version: "v1", auth });
  return cachedInspector;
}

/**
 * Ce que Google sait réellement d'une URL.
 *
 * C'est la **seule** source légitime pour les statuts DISCOVERED / CRAWLED /
 * INDEXED de notre file. Aucune autre API ne renseigne l'état d'indexation, et
 * aucune ne permet de le forcer : l'Indexing API est restreinte aux types
 * `JobPosting` et `BroadcastEvent`, et l'utiliser hors de ce cadre expose la
 * propriété à une suspension.
 *
 * Quotas de l'API URL Inspection : 2 000 requêtes par jour et 600 par minute et
 * par propriété. Le cron respecte les deux (voir `lib/seo/inspection.ts`).
 */
export type UrlInspection = {
  /** PASS | PARTIAL | FAIL | NEUTRAL | VERDICT_UNSPECIFIED */
  verdict: string | null;
  /** Texte brut de Google : « Submitted and indexed », « Crawled - currently not indexed »… */
  coverageState: string | null;
  robotsTxtState: string | null;
  indexingState: string | null;
  /** Canonique choisie par Google — peut différer de celle que nous déclarons. */
  googleCanonical: string | null;
  userCanonical: string | null;
  lastCrawlTime: string | null;
  /** Comment Google a trouvé l'URL (sitemap, référents). */
  referringUrls: string[];
  sitemaps: string[];
};

export async function inspectUrl(url: string): Promise<UrlInspection> {
  if (!SITE_URL) throw new Error("SEARCH_CONSOLE_SITE_URL manquant");

  const res = await getInspector().urlInspection.index.inspect({
    requestBody: { inspectionUrl: url, siteUrl: SITE_URL, languageCode: "fr" },
  });

  const r = res.data.inspectionResult?.indexStatusResult;
  return {
    verdict: r?.verdict ?? null,
    coverageState: r?.coverageState ?? null,
    robotsTxtState: r?.robotsTxtState ?? null,
    indexingState: r?.indexingState ?? null,
    googleCanonical: r?.googleCanonical ?? null,
    userCanonical: r?.userCanonical ?? null,
    lastCrawlTime: r?.lastCrawlTime ?? null,
    referringUrls: r?.referringUrls ?? [],
    sitemaps: r?.sitemap ?? [],
  };
}

/** État déclaré des sitemaps côté Search Console (dernier téléchargement, erreurs). */
export async function listSitemaps() {
  if (!SITE_URL) throw new Error("SEARCH_CONSOLE_SITE_URL manquant");
  const res = await getSearchConsole().sitemaps.list({ siteUrl: SITE_URL });
  return (res.data.sitemap ?? []).map((s) => ({
    path: s.path ?? "",
    lastSubmitted: s.lastSubmitted ?? null,
    lastDownloaded: s.lastDownloaded ?? null,
    warnings: Number(s.warnings ?? 0),
    errors: Number(s.errors ?? 0),
    isPending: !!s.isPending,
  }));
}

export type SearchAnalyticsRow = {
  /** Valeurs des dimensions demandées, dans l'ordre (query, page, date…). */
  keys: string[];
  clicks: number;
  impressions: number;
  /** Taux de clic 0..1. */
  ctr: number;
  /** Position moyenne (1 = top). */
  position: number;
};

type QueryOptions = {
  /** Date début incluse, format "YYYY-MM-DD". */
  startDate: string;
  /** Date fin incluse, format "YYYY-MM-DD". */
  endDate: string;
  /** Dimensions à ventiler : "query" | "page" | "date" | "country" | "device". */
  dimensions?: Array<"query" | "page" | "date" | "country" | "device">;
  /** Nombre max de lignes (API plafonne à 25000). */
  rowLimit?: number;
  /** Décalage pour la pagination. */
  startRow?: number;
  /** Type de recherche : web (défaut), image, video. */
  searchType?: "web" | "image" | "video";
};

/**
 * Requête brute Search Analytics. Brique de base ; les helpers ci-dessous
 * l'enveloppent pour les usages courants.
 */
export async function querySearchAnalytics(
  opts: QueryOptions,
): Promise<SearchAnalyticsRow[]> {
  if (!SITE_URL) {
    throw new Error("SEARCH_CONSOLE_SITE_URL manquant");
  }

  const wm = getSearchConsole();
  const res = await wm.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: opts.startDate,
      endDate: opts.endDate,
      dimensions: opts.dimensions ?? [],
      rowLimit: opts.rowLimit ?? 1000,
      startRow: opts.startRow ?? 0,
      searchType: opts.searchType ?? "web",
    },
  });

  return (res.data.rows ?? []).map((r) => ({
    keys: r.keys ?? [],
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
}

/** Décale une date de N jours, renvoie "YYYY-MM-DD". */
function shiftDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Top requêtes sur les `days` derniers jours.
 * Note : Search Console a ~2-3 jours de latence — la fin de fenêtre est J-3.
 */
export function topQueries(days = 28, rowLimit = 500) {
  return querySearchAnalytics({
    startDate: shiftDate(-days - 3),
    endDate: shiftDate(-3),
    dimensions: ["query"],
    rowLimit,
  });
}

/** Top pages sur les `days` derniers jours. */
export function topPages(days = 28, rowLimit = 500) {
  return querySearchAnalytics({
    startDate: shiftDate(-days - 3),
    endDate: shiftDate(-3),
    dimensions: ["page"],
    rowLimit,
  });
}

/**
 * Agrégats globaux du site sur les `days` derniers jours (sans ventilation).
 * Renvoie une ligne unique : clics, impressions, CTR et position moyens.
 */
export async function siteTotals(days = 28): Promise<SearchAnalyticsRow> {
  const rows = await querySearchAnalytics({
    startDate: shiftDate(-days - 3),
    endDate: shiftDate(-3),
    dimensions: [],
    rowLimit: 1,
  });
  return (
    rows[0] ?? { keys: [], clicks: 0, impressions: 0, ctr: 0, position: 0 }
  );
}

export type EmergingKeyword = {
  query: string;
  recentImpressions: number;
  priorImpressions: number;
  /** Ratio de croissance ; Infinity = aucune impression sur la période avant. */
  growth: number;
  ctr: number;
  position: number;
};

/**
 * Mots-clés émergents : compare deux fenêtres de `windowDays` jours et renvoie
 * les requêtes dont les impressions ont le plus progressé. C'est le signal de
 * tendance pour l'IA SEO — intention de recherche qui monte.
 */
export async function emergingKeywords(
  windowDays = 14,
  minImpressions = 20,
): Promise<EmergingKeyword[]> {
  const recentStart = shiftDate(-windowDays - 3);
  const recentEnd = shiftDate(-3);
  const priorStart = shiftDate(-windowDays * 2 - 3);
  const priorEnd = shiftDate(-windowDays - 4);

  const [recent, prior] = await Promise.all([
    querySearchAnalytics({
      startDate: recentStart,
      endDate: recentEnd,
      dimensions: ["query"],
      rowLimit: 5000,
    }),
    querySearchAnalytics({
      startDate: priorStart,
      endDate: priorEnd,
      dimensions: ["query"],
      rowLimit: 5000,
    }),
  ]);

  const priorMap = new Map(prior.map((r) => [r.keys[0], r.impressions]));

  return recent
    .filter((r) => r.impressions >= minImpressions)
    .map((r) => {
      const query = r.keys[0];
      const priorImpressions = priorMap.get(query) ?? 0;
      const growth =
        priorImpressions === 0
          ? Infinity
          : r.impressions / priorImpressions;
      return {
        query,
        recentImpressions: r.impressions,
        priorImpressions,
        growth,
        ctr: r.ctr,
        position: r.position,
      };
    })
    .filter((k) => k.growth > 1.5)
    .sort((a, b) => b.growth - a.growth);
}

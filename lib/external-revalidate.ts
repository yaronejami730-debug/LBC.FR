/**
 * Revalidation des annonces importées depuis une source externe.
 *
 * ── Le problème corrigé ────────────────────────────────────────────────────
 *
 * 129 annonces publiées viennent de flux partenaires, importées il y a des
 * mois et jamais revérifiées depuis. Un relevé sur 20 fiches source mesure
 * qu'environ deux tiers des véhicules ne sont plus en vente (vendus ou page
 * disparue) — nos fiches continuent pourtant d'afficher un prix avec un
 * balisage `Offer` qui l'affirme à Google.
 *
 * `lib/external-sync.ts` ne couvre que les 6 annonces rattachées à un
 * `ExternalSource`. Les 123 autres ont été importées une par une
 * (`importListingByUrl`, `externalId = link:<url>`) et n'appartiennent à
 * aucune source — le seul fil qui les relie toutes est `metadata.sourceUrl`,
 * présent sur chacune d'entre elles quelle que soit leur origine. C'est donc
 * l'annonce elle-même, et non une source, qui est l'unité de travail ici.
 *
 * ── Le tri par ancienneté sans colonne dédiée ──────────────────────────────
 *
 * `revalidatedAt` vit dans `metadata` (colonne `String` sérialisée), donc il
 * est impossible de trier au niveau SQL. Le volume actuel (129 annonces, et
 * plus généralement toutes celles important un `externalId`) tient largement
 * en mémoire : on charge tout, on trie côté application, on tranche le lot.
 * Si ce volume devait un jour se compter en dizaines de milliers, il faudrait
 * une colonne indexée dédiée — prématuré tant que ce n'est pas le cas.
 *
 * ── Le garde-fou le plus important ─────────────────────────────────────────
 *
 * Un timeout réseau ou une erreur DNS ne dit RIEN sur l'état de l'annonce à
 * la source — seulement que nous n'avons pas réussi à la joindre cette fois.
 * Confondre les deux retirerait des annonces bien vivantes au premier orage
 * réseau. `revalidateConsecutiveFailures` compte ces échecs dans `metadata`
 * et seul le troisième consécutif déclenche un retrait ; un succès, quel
 * qu'en soit le verdict, remet le compteur à zéro.
 */

import type { PrismaClient } from "@prisma/client";
import { FETCH_HEADERS } from "./external-extract";
import { removeListing } from "./moderation/removal";
import { onListingRemoved } from "./seo/lifecycle";
import { deleteListingFromIndex } from "./opensearch-sync";

/**
 * Taille de lot par passage.
 *
 * La revalidation ne fait qu'un fetch HTML par annonce (pas d'appel Claude,
 * contrairement à `external-sync`) : le coût est celui du réseau, pas celui
 * d'un budget d'extraction. 40 par passage, traité par sous-lots de 8 en
 * parallèle (voir `CONCURRENCY`), tient large sous les 300 s de `maxDuration`
 * même si chaque fetch consomme tout son timeout de 8 s (5 sous-lots × 8 s =
 * 40 s dans le pire des cas). Avec un cron toutes les 2 h (cf. `vercel.json`),
 * 40/passage rattrape les 129 annonces en une demi-journée puis maintient un
 * cycle de fraîcheur d'environ 6 h en régime établi.
 */
export const DEFAULT_BATCH_SIZE = 40;

/** Fetchs simultanés au sein d'un même lot. */
const CONCURRENCY = 8;

/** Timeout par requête source. */
const FETCH_TIMEOUT_MS = 8_000;

/**
 * Nombre d'échecs réseau consécutifs avant de traiter une source comme
 * définitivement injoignable.
 *
 * Choisi à 3 plutôt que 2 : le cron tourne toutes les 2 h, donc 3 échecs de
 * suite représentent au moins ~4 h d'indisponibilité continue de la source,
 * pas un simple pic de latence. Le retrait qui en résulte passe par
 * `removeListing` (réversible, 21 jours) — jamais une suppression définitive.
 */
export const FAILURE_THRESHOLD = 3;

/** Écart de prix minimal (%) avant de journaliser une dérive. Sous ce seuil, du bruit d'arrondi. */
const PRICE_DRIFT_THRESHOLD_PCT = 3;

type ExternalMeta = {
  sourceUrl?: string;
  externalId?: string;
  importedVia?: string;
  revalidatedAt?: string;
  revalidateConsecutiveFailures?: number;
  [key: string]: unknown;
};

type Candidate = {
  id: string;
  title: string;
  price: number;
  metadata: ExternalMeta;
};

export type RevalidateOutcome =
  | "removed_gone"
  | "removed_unreachable"
  | "sold"
  | "unreachable_retry"
  | "unchanged"
  | "unchanged_price_drift"
  | "error";

export type RevalidateDetail = {
  listingId: string;
  title: string;
  outcome: RevalidateOutcome;
  note: string;
};

export type RevalidateSummary = {
  checked: number;
  removed: number;
  sold: number;
  unchanged: number;
  errors: number;
  details: RevalidateDetail[];
};

/** Normalise le contenu HTML brut en disponibilité schema.org. */
function normalizeAvailability(html: string): "InStock" | "SoldOut" | "OutOfStock" | "Discontinued" | null {
  // Priorité au JSON-LD schema.org — la source la plus explicite et la moins
  // ambiguë (valeur canonique, pas d'abréviation à interpréter).
  const jsonLd = html.match(/schema\.org\/(InStock|SoldOut|OutOfStock|Discontinued)/);
  if (jsonLd) return jsonLd[1] as "InStock" | "SoldOut" | "OutOfStock" | "Discontinued";

  // Repli : balises Open Graph / Facebook Product (`og:availability`,
  // `product:availability`), valeurs libres et souvent abrégées.
  const meta =
    html.match(/<meta[^>]+property=["'](?:og|product):availability["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["'](?:og|product):availability["']/i);
  if (!meta) return null;

  const v = meta[1].toLowerCase().replace(/[\s_-]/g, "");
  if (v.includes("outofstock") || v === "oos") return "OutOfStock";
  if (v.includes("soldout")) return "SoldOut";
  if (v.includes("discontinued")) return "Discontinued";
  if (v.includes("instock") || v === "available") return "InStock";
  return null;
}

/** Extrait un prix affiché à la source, best-effort (méta OG puis JSON-LD). */
function extractSourcePrice(html: string): number | null {
  const meta = html.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([\d.,]+)["']/i);
  if (meta) {
    const n = Number(meta[1].replace(",", "."));
    if (!isNaN(n) && n > 0) return n;
  }
  const jsonLd = html.match(/"price"\s*:\s*"?([\d.]+)"?\s*,\s*"priceCurrency"/);
  if (jsonLd) {
    const n = Number(jsonLd[1]);
    if (!isNaN(n) && n > 0) return n;
  }
  return null;
}

/**
 * Une redirection qui aboutit sur une page générique (accueil, page agence,
 * page de recherche) plutôt que sur une fiche précise. Le code HTTP seul ne
 * dit rien : ce genre de redirection répond 200, exactement comme la fiche
 * qu'elle a remplacée. Ce qui trahit la disparition, c'est la forme de l'URL
 * finale — mesuré sur agenceauto.com : une fiche disparue redirige de
 * `/agences/<agence>/<slug-fiche>.html` (5 segments) vers `/agences/<agence>`
 * (4 segments), quand une simple correction de slug garde la même profondeur
 * et l'extension `.html`.
 */
export function isGenericRedirect(original: URL, final: URL): boolean {
  if (final.hostname !== original.hostname) return false; // changement de domaine — jugé ailleurs (échec réseau ou gone HTTP)
  const origSegs = original.pathname.split("/").filter(Boolean);
  const finalSegs = final.pathname.split("/").filter(Boolean);
  if (finalSegs.length === 0) return true; // racine du domaine
  if (finalSegs.length < origSegs.length) return true; // remontée d'un ou plusieurs niveaux dans l'arborescence
  const last = finalSegs[finalSegs.length - 1].toLowerCase();
  const GENERIC_LAST_SEGMENTS = [
    "accueil",
    "home",
    "index",
    "index.html",
    "recherche",
    "search",
    "annonces",
    "biens",
    "vehicules",
    "voitures",
    "occasions",
    "cars",
  ];
  if (GENERIC_LAST_SEGMENTS.includes(last)) return true;
  return false;
}

type FetchOutcome =
  | { kind: "network_error" }
  | { kind: "gone_http"; status: number }
  | { kind: "gone_redirect" }
  | { kind: "unreachable_status"; status: number }
  | { kind: "ok"; html: string };

/** Requête source pour une revalidation — jamais d'exception qui remonte. */
async function fetchForRevalidation(sourceUrl: string): Promise<FetchOutcome> {
  let original: URL;
  try {
    original = new URL(sourceUrl);
  } catch {
    return { kind: "network_error" };
  }

  let res: Response;
  try {
    res = await fetch(sourceUrl, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return { kind: "network_error" };
  }

  if (res.status === 404 || res.status === 410) return { kind: "gone_http", status: res.status };

  // 5xx et 4xx autres que 404/410 (403 anti-bot, 429 rate-limit…) sont
  // ambigus : ça peut être la source qui bloque notre requête, pas l'annonce
  // qui a disparu. Traité comme injoignable — même garde-fou de répétition
  // que les erreurs réseau, jamais un retrait direct.
  if (!res.ok) return { kind: "unreachable_status", status: res.status };

  if (res.redirected) {
    try {
      const final = new URL(res.url);
      if (isGenericRedirect(original, final)) return { kind: "gone_redirect" };
    } catch {
      /* URL finale illisible — on continue, le contenu tranchera */
    }
  }

  const html = await res.text().catch(() => "");
  return { kind: "ok", html };
}

/** Limite la concurrence d'un `map` asynchrone à `n` exécutions simultanées. */
async function mapWithConcurrency<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return results;
}

/** Fusionne des clés dans `metadata` (colonne `String`) sans écraser le reste. */
function mergeMetadata(current: ExternalMeta, patch: Record<string, unknown>): string {
  return JSON.stringify({ ...current, ...patch });
}

async function processOne(prisma: PrismaClient, c: Candidate): Promise<RevalidateDetail> {
  const sourceUrl = c.metadata.sourceUrl;
  if (!sourceUrl || typeof sourceUrl !== "string") {
    return { listingId: c.id, title: c.title, outcome: "error", note: "metadata.sourceUrl absent ou invalide" };
  }

  const outcome = await fetchForRevalidation(sourceUrl);
  const prevFailures = c.metadata.revalidateConsecutiveFailures ?? 0;
  const now = new Date().toISOString();

  // ── Injoignable (réseau ou statut ambigu) ────────────────────────────────
  // Jamais de retrait sur un seul échec : voir le garde-fou en tête de fichier.
  if (outcome.kind === "network_error" || outcome.kind === "unreachable_status") {
    const failures = prevFailures + 1;
    if (failures >= FAILURE_THRESHOLD) {
      const reason =
        outcome.kind === "network_error"
          ? `Source injoignable (échec réseau) lors des ${failures} dernières vérifications.`
          : `Source répond ${outcome.status} de façon répétée (${failures} vérifications).`;
      await removeListing({ listingId: c.id, reason, actor: "cron:external-revalidate" });
      await onListingRemoved(c.id);
      await prisma.listing
        .update({
          where: { id: c.id },
          data: { metadata: mergeMetadata(c.metadata, { revalidatedAt: now, revalidateConsecutiveFailures: failures }) },
        })
        .catch(() => {});
      return {
        listingId: c.id,
        title: c.title,
        outcome: "removed_unreachable",
        note: reason,
      };
    }
    await prisma.listing
      .update({
        where: { id: c.id },
        data: { metadata: mergeMetadata(c.metadata, { revalidatedAt: now, revalidateConsecutiveFailures: failures }) },
      })
      .catch(() => {});
    return {
      listingId: c.id,
      title: c.title,
      outcome: "unreachable_retry",
      note: `Injoignable (${failures}/${FAILURE_THRESHOLD}) — pas d'action tant que le seuil n'est pas atteint.`,
    };
  }

  // ── Disparue à la source (404/410 ou redirection générique) ─────────────
  if (outcome.kind === "gone_http" || outcome.kind === "gone_redirect") {
    const reason =
      outcome.kind === "gone_http"
        ? `Fiche source introuvable (HTTP ${outcome.status}).`
        : "Fiche source disparue (redirection vers une page générique).";
    await removeListing({ listingId: c.id, reason, actor: "cron:external-revalidate" });
    await onListingRemoved(c.id);
    await prisma.listing
      .update({
        where: { id: c.id },
        data: { metadata: mergeMetadata(c.metadata, { revalidatedAt: now, revalidateConsecutiveFailures: 0 }) },
      })
      .catch(() => {});
    return { listingId: c.id, title: c.title, outcome: "removed_gone", note: reason };
  }

  // ── Page jointe avec succès : la source a répondu sans ambiguïté ────────
  const availability = normalizeAvailability(outcome.html);

  if (availability === "SoldOut" || availability === "OutOfStock" || availability === "Discontinued") {
    // SOLD n'est pas un retrait de modération : c'est l'aboutissement normal
    // d'une vente, pas une sanction. Pas de compte à rebours de purge (SOLD
    // n'est jamais dans `purgeExpiredListings`), la fiche reste comme
    // historique de prix (`lib/seo/price.ts`) et de confiance
    // (`lib/trust-score.ts`). `removeListing` ferait l'inverse : REMOVED
    // armerait un délai de purge de 21 jours sur un véhicule légitimement
    // vendu, ce qui serait faux.
    await prisma.listing.update({
      where: { id: c.id },
      data: {
        status: "SOLD",
        metadata: mergeMetadata(c.metadata, {
          revalidatedAt: now,
          revalidateConsecutiveFailures: 0,
          soldDetectedVia: availability,
          soldAt: now,
        }),
      },
    });
    deleteListingFromIndex(c.id).catch(() => {});
    await onListingRemoved(c.id);
    await prisma.moderationEvent
      .create({
        data: {
          listingId: c.id,
          actor: "cron:external-revalidate",
          action: "listing_marked_sold",
          reason: `Disponibilité source : ${availability}`,
        } as never,
      })
      .catch(() => {});
    return {
      listingId: c.id,
      title: c.title,
      outcome: "sold",
      note: `Disponibilité source : ${availability}`,
    };
  }

  // InStock, ou aucune balise (« la page répond normalement avec son
  // contenu ») : l'annonce reste en ligne. On en profite pour comparer le
  // prix affiché à la source.
  const sourcePrice = extractSourcePrice(outcome.html);
  let note = "Toujours en ligne à la source.";
  let priceOutcome: RevalidateOutcome = "unchanged";
  const patch: Record<string, unknown> = { revalidatedAt: now, revalidateConsecutiveFailures: 0 };

  if (sourcePrice != null && c.price > 0) {
    const diffPct = ((sourcePrice - c.price) / c.price) * 100;
    if (Math.abs(diffPct) >= PRICE_DRIFT_THRESHOLD_PCT) {
      priceOutcome = "unchanged_price_drift";
      note = `Toujours en ligne — écart de prix : nous ${c.price} € / source ${sourcePrice} € (${diffPct.toFixed(1)}%).`;
      patch.priceCheck = { sourcePrice, ourPrice: c.price, diffPct: Number(diffPct.toFixed(1)), checkedAt: now };
      console.log(`[external-revalidate] ${c.id} — ${note}`);
    }
  }

  await prisma.listing
    .update({ where: { id: c.id }, data: { metadata: mergeMetadata(c.metadata, patch) } })
    .catch(() => {});

  return { listingId: c.id, title: c.title, outcome: priceOutcome, note };
}

/**
 * Revalide un lot d'annonces importées, quelle que soit leur origine.
 *
 * Ne s'appuie sur aucun `ExternalSource` : le filtre porte sur les annonces
 * elles-mêmes (`metadata.importedVia` / `metadata.externalId`), donc les 123
 * annonces importées au lien (`link:<url>`) sont couvertes au même titre que
 * les 6 rattachées à une source active.
 */
export async function revalidateExternalListings(
  prisma: PrismaClient,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<RevalidateSummary> {
  const rows = await prisma.listing.findMany({
    where: {
      status: "APPROVED",
      deletedAt: null,
      OR: [
        { metadata: { contains: '"importedVia":"external_api"' } },
        { metadata: { contains: '"externalId"' } },
      ],
    },
    select: { id: true, title: true, price: true, metadata: true },
  });

  const candidates: Candidate[] = [];
  const parseErrors: RevalidateDetail[] = [];
  for (const r of rows) {
    try {
      const meta = JSON.parse(r.metadata || "{}") as ExternalMeta;
      candidates.push({ id: r.id, title: r.title, price: r.price, metadata: meta });
    } catch {
      parseErrors.push({ listingId: r.id, title: r.title, outcome: "error", note: "metadata illisible (JSON invalide)" });
    }
  }

  // Les moins récemment revalidées en premier ; jamais revalidées = priorité maximale.
  candidates.sort((a, b) => {
    const ta = a.metadata.revalidatedAt ? Date.parse(a.metadata.revalidatedAt) : 0;
    const tb = b.metadata.revalidatedAt ? Date.parse(b.metadata.revalidatedAt) : 0;
    return ta - tb;
  });

  const batch = candidates.slice(0, batchSize);
  const details = await mapWithConcurrency(batch, CONCURRENCY, (c) => processOne(prisma, c));

  const all = [...parseErrors, ...details];
  const summary: RevalidateSummary = {
    checked: all.length,
    removed: all.filter((d) => d.outcome === "removed_gone" || d.outcome === "removed_unreachable").length,
    sold: all.filter((d) => d.outcome === "sold").length,
    unchanged: all.filter((d) => d.outcome === "unchanged" || d.outcome === "unchanged_price_drift" || d.outcome === "unreachable_retry").length,
    errors: all.filter((d) => d.outcome === "error").length,
    details: all,
  };
  return summary;
}

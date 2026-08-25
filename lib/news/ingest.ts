/**
 * Captation des flux de presse.
 *
 * ── Ce que cette ingestion produit, et ce qu'elle ne produira jamais ──────
 *
 * Elle produit des **lignes de signal** : un titre, sa date, son lien, et le
 * couple marque/modèle qu'on a su y reconnaître. Elle ne produit aucune page,
 * aucun article, aucun texte republié. Le résumé du flux est conservé pour le
 * classement interne et n'est jamais rendu tel quel sur une page indexable.
 *
 * La raison est directement celle qui vaut à 129 de nos propres annonces
 * d'être exclues de l'index sous le motif « importée d'une source externe » :
 * republier le travail d'autrui sous son domaine ne crée pas de valeur, et
 * Google le traite comme tel. Ce que nous apportons, c'est le rapprochement —
 * cette actualité, à côté de ce modèle, avec les annonces que nous en avons.
 *
 * ── Le catalogue de modèles vient de nos annonces ─────────────────────────
 *
 * Le rattachement se fait contre les modèles réellement présents en base, pas
 * contre une liste figée. Un modèle dont nous n'avons rien à montrer n'a pas de
 * page à alimenter : le reconnaître ne servirait à rien.
 */

import { prisma } from "@/lib/prisma";
import {
  NEWS_SOURCES,
  MAX_AGE_DAYS,
  MOTOR1_AUTHORS,
  MOTOR1_SPONSORED_AUTHOR,
  authorFeedUrl,
  isExcludedCategory,
  type NewsSource,
} from "@/lib/news/sources";
import { parseFeed, type FeedItem } from "@/lib/news/parse";
import { fetchArticleExtras } from "@/lib/news/fulltext";
import { matchTitle, type ModelCatalogue, type ModelEntry } from "@/lib/news/match";
import { normalizeToken } from "@/lib/seo/city";
import { newsSlug } from "@/lib/news/slug";

/** Un flux qui ne répond pas ne doit pas tenir le cron en otage. */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Modèles connus, construits depuis les annonces véhicules publiées.
 *
 * Les annonces vendues comptent aussi : un modèle vendu la semaine dernière a
 * toujours sa page de cote, et c'est justement celle qui gagne à rester vivante.
 */
export async function buildModelCatalogue(): Promise<ModelCatalogue> {
  const rows = await prisma.listing.findMany({
    where: { status: { in: ["APPROVED", "SOLD"] } },
    select: { metadata: true },
    take: 20_000,
  });

  const catalogue: ModelCatalogue = new Map();
  const seen = new Set<string>();

  for (const row of rows) {
    let marque: unknown;
    let modele: unknown;
    try {
      const meta = JSON.parse(row.metadata ?? "{}");
      marque = meta?.marque;
      modele = meta?.modele;
    } catch {
      continue;
    }
    if (typeof marque !== "string" || typeof modele !== "string") continue;

    const brandSlug = normalizeToken(marque);
    const modelSlug = normalizeToken(modele);
    if (!brandSlug || !modelSlug) continue;

    const key = `${brandSlug}/${modelSlug}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const entry: ModelEntry = { slug: modelSlug, label: modele.trim() };
    const list = catalogue.get(brandSlug);
    if (list) list.push(entry);
    else catalogue.set(brandSlug, [entry]);
  }

  return catalogue;
}

async function fetchFeed(source: NewsSource): Promise<FeedItem[]> {
  const res = await fetch(source.url, {
    headers: {
      // Un agent identifiable : le média doit pouvoir voir qui le lit et nous
      // écrire si notre rythme le dérange.
      "user-agent": "DealAndCoBot/1.0 (+https://www.dealandcompany.fr)",
      accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseFeed(await res.text());
}

/**
 * Budget de lecture des pages d'article, pour un passage de captation.
 *
 * ── Pourquoi un budget, et pas « on lit tout » ────────────────────────────
 *
 * Ouvrir la page d'un article prend entre une demi-seconde et deux secondes.
 * Le cron dispose de 120 secondes (`maxDuration`), et il a d'autres choses à
 * faire que lire des pages : capter treize flux, recouper les signatures,
 * purger. Sans plafond, un passage un peu lent se ferait couper au milieu, et
 * ce sont les derniers flux de la liste qui n'entreraient jamais.
 *
 * Le budget est donc double, et les deux bornes comptent :
 *
 *   · `remaining` — un nombre de pages par passage. Les articles non lus cette
 *     fois-ci le seront au passage suivant : leur ligne existe déjà en base,
 *     avec son `excerpt` à `null`, et c'est précisément ce que la condition de
 *     lecture cherche ;
 *   · `deadline` — une heure au-delà de laquelle on ne commence plus rien. Elle
 *     protège la fin de la captation même si les pages répondent lentement.
 *
 * Conséquence assumée : un article peut être en ligne avec son seul chapô
 * pendant une heure avant de recevoir sa citation longue. C'est préférable à un
 * article absent.
 */
export type QuoteBudget = { remaining: number; deadline: number };

export function makeQuoteBudget(pages = 60, msAvailable = 75_000): QuoteBudget {
  return { remaining: pages, deadline: Date.now() + msAvailable };
}

function budgetAllows(budget: QuoteBudget | null): budget is QuoteBudget {
  return budget !== null && budget.remaining > 0 && Date.now() < budget.deadline;
}

export type IngestReport = {
  source: string;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  matchedBrand: number;
  matchedModel: number;
  /** Citations obtenues en ouvrant la page du média, faute de corps dans le flux. */
  quoted: number;
  /** Visuels relevés sur la page du média, faute d'image dans le flux. */
  illustrated: number;
  error?: string;
};

export async function ingestSource(
  source: NewsSource,
  catalogue: ModelCatalogue,
  budget: QuoteBudget | null = null,
): Promise<IngestReport> {
  const report: IngestReport = {
    source: source.key,
    fetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    matchedBrand: 0,
    matchedModel: 0,
    quoted: 0,
    illustrated: 0,
  };

  let items: FeedItem[];
  try {
    items = await fetchFeed(source);
  } catch (e) {
    // Un flux indisponible n'est pas une panne du site : on le note et on passe.
    report.error = (e as Error).message;
    return report;
  }

  report.fetched = items.length;
  // La fenêtre dépend de la nature du flux : un essai vit trois ans, une
  // actualité quatre mois. Voir `NewsKind` dans `sources.ts`.
  const cutoff = Date.now() - MAX_AGE_DAYS[source.kind] * 24 * 3600 * 1000;

  for (const item of items) {
    if (item.publishedAt.getTime() < cutoff || isExcludedCategory(item.categories)) {
      report.skipped++;
      continue;
    }

    const { brandSlug, modelSlug } = matchTitle(item.title, catalogue);
    if (brandSlug) report.matchedBrand++;
    if (modelSlug) report.matchedModel++;

    // `upsert` sur l'URL : un média retouche régulièrement le titre d'un
    // article publié. On veut la version à jour, pas deux lignes.
    const before = await prisma.newsItem.findUnique({
      where: { url: item.url },
      select: { id: true, slug: true, excerpt: true, imageUrl: true },
    });

    /**
     * La citation longue, dans l'ordre des sources les plus légitimes.
     *
     *   1. le corps publié **par le flux** — un média qui met son texte dans
     *      son RSS le met là pour être repris, il n'y a rien à discuter ;
     *   2. celle déjà en base — on ne relit jamais deux fois la même page ;
     *   3. la page publique de l'article, dans la limite du budget du passage.
     *
     * Le troisième cas est celui de presque tous les médias français : mesuré
     * le 24/08/2026, un seul flux sur seize publie le corps de ses articles.
     * Sans lui, la moitié du site afficherait deux lignes sous une photo.
     */
    let excerpt = item.excerpt ?? before?.excerpt ?? null;

    /**
     * Le visuel, dans le même ordre de légitimité que la citation : celui du
     * flux, puis celui déjà en base, puis celui que la page déclare en
     * `og:image`.
     *
     * Cette troisième voie n'est pas un confort. Le fil n'affiche que les
     * articles illustrés — une carte sans visuel casse une grille — et
     * plusieurs flux, dont Courrier Cadres, ne publient aucune image tout en
     * ayant une photo sur chaque article. Sans elle, une rubrique entière
     * resterait invisible malgré des articles captés.
     */
    let imageUrl = item.imageUrl ?? before?.imageUrl ?? null;

    // Une seule ouverture de page pour les deux manques : on n'y va que s'il
    // en reste au moins un, et jamais deux fois.
    if ((!excerpt || !imageUrl) && budgetAllows(budget)) {
      budget.remaining--;
      const extras = await fetchArticleExtras(item.url);
      if (!excerpt && extras.quote) {
        excerpt = extras.quote;
        report.quoted++;
      }
      if (!imageUrl && extras.imageUrl) {
        imageUrl = extras.imageUrl;
        report.illustrated++;
      }
    }

    const data = {
      source: source.key,
      title: item.title,
      summary: item.summary,
      publishedAt: item.publishedAt,
      brandSlug,
      modelSlug,
      categories: JSON.stringify(item.categories.slice(0, 8)),
      imageUrl,
      // Signature du flux quand il en publie une. Sinon `null`, et le
      // recoupement par flux d'auteur prendra le relais s'il existe.
      authorName: item.author?.slice(0, 120) ?? null,
      excerpt,
    };

    await prisma.newsItem.upsert({
      where: { url: item.url },
      // Le slug n'est posé qu'à la création, et n'apparaît volontairement pas
      // dans `update` : un média qui retouche son titre ne doit pas déplacer
      // une page déjà en ligne.
      create: { url: item.url, slug: newsSlug(item.title, item.url), ...data },
      update: {
        ...data,
        fetchedAt: new Date(),
        // Le slug existant est conservé tel quel — une page en ligne ne se
        // déplace pas parce que le média a retouché son titre. Il n'est
        // calculé ici que pour les lignes captées avant l'existence de la
        // colonne, qui n'en ont encore aucun.
        ...(before?.slug ? {} : { slug: newsSlug(item.title, item.url) }),
        // Une signature déjà en base ne se fait pas écraser par un `null`.
        ...(item.author ? {} : { authorName: undefined }),
      },
    });
    if (before) report.updated++;
    else report.created++;
  }

  return report;
}

/**
 * Recoupe les flux par journaliste pour rendre à chaque article sa signature,
 * et supprime ce qui vient du flux « contenu sponsorisé ».
 *
 * Passage après coup plutôt qu'à la captation : un article apparaît dans le
 * flux de sa rubrique et dans celui de son auteur, et attendre d'avoir les deux
 * évite de capter deux fois la même chose.
 */
export async function attachAuthors(): Promise<{ signed: number; sponsored: number }> {
  let signed = 0;
  let sponsored = 0;

  const feeds: { name: string | null; slug: string }[] = [
    ...MOTOR1_AUTHORS.map((a) => ({ name: a.name, slug: a.slug })),
    // `name: null` marque le flux sponsorisé : ses articles sont supprimés,
    // pas signés.
    { name: null, slug: MOTOR1_SPONSORED_AUTHOR },
  ];

  for (const feed of feeds) {
    let items: FeedItem[];
    try {
      const res = await fetch(authorFeedUrl(feed.slug), {
        headers: { "user-agent": "DealAndCoBot/1.0 (+https://www.dealandcompany.fr)" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) continue;
      items = parseFeed(await res.text());
    } catch {
      continue;
    }

    const urls = items.map((i) => i.url);
    if (urls.length === 0) continue;

    if (feed.name === null) {
      const { count } = await prisma.newsItem.deleteMany({ where: { url: { in: urls } } });
      sponsored += count;
      continue;
    }

    const { count } = await prisma.newsItem.updateMany({
      where: { url: { in: urls }, authorName: null },
      data: { authorName: feed.name },
    });
    signed += count;
  }

  return { signed, sponsored };
}

export async function ingestAll(budget: QuoteBudget | null = makeQuoteBudget()): Promise<IngestReport[]> {
  const catalogue = await buildModelCatalogue();
  const reports: IngestReport[] = [];
  // Séquentiel : quelques flux, aucune raison de taper en parallèle chez un
  // média qui nous rend service en publiant un flux ouvert.
  for (const source of NEWS_SOURCES) {
    reports.push(await ingestSource(source, catalogue, budget));
  }
  return reports;
}

/**
 * Purge des articles trop anciens.
 *
 * Une actualité de l'an dernier affichée comme « actualité » est un mensonge de
 * mise en page. La table ne conserve donc que la fenêtre qu'elle sait servir.
 */
export async function purgeOldNews(): Promise<number> {
  let total = 0;
  // Purge par nature, avec la fenêtre de chaque nature : purger les essais au
  // rythme des actualités viderait les pages modèle à chaque passage.
  for (const source of NEWS_SOURCES) {
    const cutoff = new Date(Date.now() - MAX_AGE_DAYS[source.kind] * 24 * 3600 * 1000);
    const { count } = await prisma.newsItem.deleteMany({
      where: { source: source.key, publishedAt: { lt: cutoff } },
    });
    total += count;
  }
  return total;
}

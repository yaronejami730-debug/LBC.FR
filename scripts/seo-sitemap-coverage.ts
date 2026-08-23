/**
 * Couverture du sitemap : ce qui y est, ce qui n'y est pas, et pourquoi.
 *
 *     npm run seo:coverage
 *     npm run seo:coverage -- --base=http://localhost:3000
 *
 * ── Ce que ce script répond ───────────────────────────────────────────────
 *
 * Le crawl du 23/08/2026 relevait « 56 pages sur 100 absentes du sitemap ».
 * Prise seule, la mesure ne dit rien : un sitemap n'est pas un inventaire du
 * site, c'est une liste de recommandations. Une page de recherche, une page en
 * `noindex`, une fiche annonce sous le seuil de qualité **doivent** en être
 * absentes.
 *
 * Ce qui compte est donc la répartition, et surtout deux anomalies :
 *
 *   - **manquantes à tort** — la page répond 200, elle s'indexe, et le sitemap
 *     ne la propose pas. C'est un oubli de génération, à corriger ;
 *   - **présentes à tort** — le sitemap la propose alors qu'elle répond 404 ou
 *     refuse l'index. C'est le défaut le plus coûteux : Google apprend à ne
 *     plus faire confiance au fichier, pour tout le domaine.
 *
 * Le script lit l'univers d'URL dans `SeoUrl` — la table que tient le cron
 * `seo-queue` — et le confronte au sitemap réellement servi. Il n'écrit rien.
 */
import { prisma } from "../lib/prisma";

const baseArg = process.argv.find((a) => a.startsWith("--base="));
const BASE = (baseArg?.split("=")[1] ?? "https://www.dealandcompany.fr").replace(/\/$/, "");

/** Les URL du sitemap servi, telles que Google les lit. */
async function fetchSitemapUrls(): Promise<Set<string>> {
  const res = await fetch(`${BASE}/sitemap.xml`, {
    headers: { "user-agent": "DealAndCo-SEO-Coverage/1.0" },
  });
  if (!res.ok) throw new Error(`sitemap.xml : HTTP ${res.status}`);

  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  return new Set(urls.map((u) => u.replace(/\/$/, "")));
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/$/, "") || "/";
  } catch {
    return url;
  }
}

async function main() {
  const [sitemap, rows] = await Promise.all([
    fetchSitemapUrls(),
    prisma.seoUrl.findMany({
      select: {
        url: true,
        path: true,
        type: true,
        indexable: true,
        httpStatus: true,
        exclusionReasons: true,
      },
      take: 50_000,
    }),
  ]);

  const sitemapPaths = new Set([...sitemap].map(pathOf));
  console.log(`sitemap servi : ${sitemap.size} URL · univers connu : ${rows.length} URL\n`);

  type Bucket = { announced: number; missingOnPurpose: number; missingWrongly: string[]; announcedWrongly: string[] };
  const byType = new Map<string, Bucket>();
  const bucket = (type: string): Bucket => {
    const b = byType.get(type) ?? { announced: 0, missingOnPurpose: 0, missingWrongly: [], announcedWrongly: [] };
    byType.set(type, b);
    return b;
  };

  const reasons = new Map<string, number>();

  for (const row of rows) {
    const inSitemap = sitemapPaths.has(pathOf(row.url));
    const b = bucket(row.type);

    // Une page jamais vérifiée n'a pas de code HTTP : on la croit sur son
    // verdict local plutôt que de la compter comme cassée.
    const serves = row.httpStatus === null || row.httpStatus === 200;

    if (inSitemap) {
      b.announced++;
      if (!serves || !row.indexable) {
        b.announcedWrongly.push(`${row.path} (HTTP ${row.httpStatus ?? "?"}, ${row.indexable ? "indexable" : "noindex"})`);
      }
      continue;
    }

    if (row.indexable && serves) {
      b.missingWrongly.push(row.path);
    } else {
      b.missingOnPurpose++;
      for (const reason of safeReasons(row.exclusionReasons)) {
        reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      }
    }
  }

  console.log("type              annoncées   exclues volontairement   manquantes à tort   annoncées à tort");
  for (const [type, b] of [...byType.entries()].sort()) {
    console.log(
      `${type.padEnd(16)} ${String(b.announced).padStart(9)} ${String(b.missingOnPurpose).padStart(24)} ${String(
        b.missingWrongly.length,
      ).padStart(19)} ${String(b.announcedWrongly.length).padStart(18)}`,
    );
  }

  if (reasons.size > 0) {
    console.log("\nMotifs des exclusions volontaires :");
    for (const [reason, count] of [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      console.log(`  ${String(count).padStart(5)}  ${reason}`);
    }
  }

  const missing = [...byType.values()].flatMap((b) => b.missingWrongly);
  const announced = [...byType.values()].flatMap((b) => b.announcedWrongly);

  if (missing.length > 0) {
    console.log(`\nManquantes à tort (${missing.length}) — elles répondent 200 et s'indexent :`);
    console.log(missing.slice(0, 40).map((p) => `  ${BASE}${p}`).join("\n"));
    if (missing.length > 40) console.log(`  … et ${missing.length - 40} autres`);
  }

  if (announced.length > 0) {
    console.log(`\nAnnoncées à tort (${announced.length}) — le sitemap recommande une page qui refuse :`);
    console.log(announced.slice(0, 40).map((p) => `  ${p}`).join("\n"));
  }

  if (missing.length === 0 && announced.length === 0) {
    console.log("\nAucune anomalie : le sitemap annonce exactement ce qui répond 200 et s'indexe.");
  } else {
    process.exitCode = 1;
  }
}

function safeReasons(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

main().finally(() => prisma.$disconnect());

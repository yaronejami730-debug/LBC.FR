/**
 * Balayage HTTP de l'univers d'URL publiques.
 *
 *   npm run seo:sweep              — production
 *   npm run seo:sweep -- --base=http://localhost:3000
 *   npm run seo:sweep -- --only=5xx
 *
 * ── Pourquoi ce script ────────────────────────────────────────────────────
 *
 * Search Console signale « 9 erreurs serveur (5xx) » sans jamais dire lesquelles
 * autrement qu'à la main, écran par écran, et avec plusieurs jours de retard.
 * Or une 5xx n'est pas une erreur locale : Googlebot la lit comme un serveur en
 * souffrance et réduit sa fréquence d'exploration **sur tout le domaine**.
 * C'est le seul motif du diagnostic à agir mécaniquement sur le taux de crawl,
 * donc celui qu'il faut pouvoir vérifier à la demande.
 *
 * Le script lit l'univers d'URL dans la table `SeoUrl` — celle que le cron
 * `seo-queue` tient à jour — demande chaque URL comme un crawler le ferait, et
 * réécrit le code obtenu dans `SeoUrl.httpStatus`. Deux usages :
 *
 *   — avant déploiement, sur `localhost`, pour ne pas publier de régression ;
 *   — après, sur la production, pour répondre « 0 5xx » avec une mesure plutôt
 *     qu'avec une intention.
 *
 * Il lit la table plutôt que d'appeler `buildQueueEntries()` pour une raison
 * technique : l'inventaire passe par `unstable_cache`, qui exige le runtime de
 * Next et lève hors serveur. La table dit de toute façon la même chose, avec un
 * jour de retard au pire — et c'est elle que le balayage annote.
 *
 * Il est volontairement lent (concurrence faible, `GET` réels) : il vaut mieux
 * un balayage de quelques minutes qu'un pic de charge qui produirait lui-même
 * les erreurs qu'on cherche.
 */

import { BASE } from "../lib/seo/queue";
import { prisma } from "../lib/prisma";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const base = (flag("base") ?? BASE).replace(/\/$/, "");
const only = flag("only"); // "5xx" | "4xx" | undefined
const concurrency = Number(flag("concurrency") ?? 4);
const limit = Number(flag("limit") ?? Infinity);

/** Un crawler s'annonce. Un script qui se déguise fausse ses propres mesures. */
const USER_AGENT = "DealAndCoSeoSweep/1.0 (+https://www.dealandcompany.fr)";

type Result = { url: string; path: string; status: number; ms: number; error?: string };

async function probe(url: string, path: string): Promise<Result> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(30_000),
    });
    return { url, path, status: res.status, ms: Date.now() - started };
  } catch (err) {
    // Un échec réseau n'est pas un code HTTP. On le note à 0 pour ne pas le
    // confondre avec une 5xx applicative, qui se corrige tout autrement.
    return { url, path, status: 0, ms: Date.now() - started, error: String(err) };
  }
}

async function main() {
  // On ne balaie pas les URL déjà closes : une page retirée répond 404, c'est
  // le comportement voulu, et l'annoncer chaque jour noierait le signal.
  const entries = await prisma.seoUrl.findMany({
    where: { status: { not: "GONE" } },
    select: { url: true, path: true },
    orderBy: { score: "desc" },
    take: Number.isFinite(limit) ? limit : 50_000,
  });

  if (entries.length === 0) {
    console.log(
      "[sweep] table SeoUrl vide — lancer d'abord le cron `seo-queue` " +
        "(`/api/cron/seo-queue`), qui la construit.",
    );
    await prisma.$disconnect();
    return;
  }

  const targets = entries;

  console.log(`[sweep] ${targets.length} URL à vérifier sur ${base}\n`);

  const results: Result[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < targets.length) {
      const entry = targets[cursor++];
      const result = await probe(`${base}${entry.path}`, entry.path);
      results.push(result);

      const bucket = Math.floor(result.status / 100);
      if (bucket === 5 || result.status === 0) {
        console.log(`\x1b[31m${result.status || "ERR"}\x1b[0m ${result.path}${result.error ? ` — ${result.error}` : ""}`);
      } else if (bucket === 4) {
        console.log(`\x1b[33m${result.status}\x1b[0m ${result.path}`);
      } else if (!only) {
        console.log(`\x1b[32m${result.status}\x1b[0m ${result.path} (${result.ms} ms)`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

  // ── Bilan ────────────────────────────────────────────────────────────────
  const byBucket = new Map<string, number>();
  for (const r of results) {
    const key = r.status === 0 ? "réseau" : `${Math.floor(r.status / 100)}xx`;
    byBucket.set(key, (byBucket.get(key) ?? 0) + 1);
  }

  console.log("\n── Bilan ──");
  for (const [bucket, n] of [...byBucket.entries()].sort()) {
    console.log(`  ${bucket.padEnd(8)} ${n}`);
  }

  const failures = results.filter((r) => r.status === 0 || r.status >= 500);
  if (failures.length > 0) {
    console.log("\n── Erreurs serveur ──");
    for (const f of failures) console.log(`  ${f.status || "ERR"}  ${f.url}`);
  }

  // Le code observé est écrit dans la file : le tableau de bord SEO cesse ainsi
  // d'afficher « éligible » pour une URL qui répond 500.
  if (base === BASE) {
    let written = 0;
    for (const r of results) {
      await prisma.seoUrl
        .update({
          where: { url: r.url },
          data: { httpStatus: r.status || null, lastCheckedAt: new Date() },
        })
        .then(() => {
          written++;
        })
        .catch(() => {});
    }
    console.log(`\n[sweep] ${written} lignes SeoUrl mises à jour.`);
  } else {
    console.log(`\n[sweep] base ≠ production : rien n'est écrit en base.`);
  }

  await prisma.$disconnect();
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

/**
 * Tableau URL par URL : ce que chaque adresse renvoyait, ce qu'elle renvoie.
 *
 *   npm run seo:url-report -- --urls=liste.txt --out=rapport
 *   npm run seo:url-report -- --urls=liste.txt --before=avant.json --out=rapport
 *
 * ── Pourquoi ce script ────────────────────────────────────────────────────
 *
 * « Les 404 ont été corrigées » n'est pas une phrase vérifiable. « Sur ces 572
 * adresses, 412 renvoyaient 404, il en reste 386 en 410 volontaire et 26 en 301
 * vers la page de marque » l'est. La différence tient à ce qu'on peut relire
 * ligne à ligne — et c'est cette relecture, pas le total, qui attrape la
 * redirection posée vers une page qui n'existe pas non plus.
 *
 * Le script relève trois choses par URL, parce que trois défauts distincts s'y
 * cachent :
 *
 *   — le **code**, qui dit si la page répond ;
 *   — la **destination** d'une redirection, qui dit si elle mène quelque part —
 *     une 301 vers une 404 se lit « corrigé » dans un total par code, et reste
 *     une impasse ;
 *   — l'en-tête **`x-vercel-cache`**, qui dit si le CDN a servi la page ou si
 *     l'origine a dû la rendre. C'est la mesure qui manquait au diagnostic du
 *     11/08 : un site peut être rapide URL par URL et s'effondrer sous un
 *     crawl, simplement parce que rien n'est mis en cache.
 *
 * La concurrence est basse par défaut et réglable. Le relevé du 28/08 a montré
 * qu'une concurrence trop haute produit les délais d'attente qu'on prétend
 * mesurer — depuis le poste qui mesure, pas depuis le serveur mesuré. Un
 * balayage lent dit la vérité ; un balayage rapide mesure sa propre saturation.
 */

import fs from "node:fs";

const args = process.argv.slice(2);
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];

const urlsFile = flag("urls");
const beforeFile = flag("before");
const outBase = flag("out") ?? "seo-url-report";
const concurrency = Number(flag("concurrency") ?? 3);

if (!urlsFile) {
  console.error("Usage: --urls=<fichier, une URL par ligne> [--before=<probe.json>] [--out=<base>] [--concurrency=3]");
  process.exit(1);
}
const urlsPath: string = urlsFile;

/** Un crawler s'annonce. Un script déguisé fausse ses propres mesures. */
const USER_AGENT = "DealAndCoSeoSweep/1.0 (+https://www.dealandcompany.fr)";

type Probe = {
  url: string;
  status: number;
  ms: number;
  location: string | null;
  cache: string | null;
  error?: string;
};

async function probe(url: string): Promise<Probe> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      // `manual` est indispensable : suivre la redirection renverrait le code de
      // la destination et masquerait précisément ce qu'on veut vérifier.
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(30_000),
    });
    await res.arrayBuffer().catch(() => {});
    return {
      url,
      status: res.status,
      ms: Date.now() - started,
      location: res.headers.get("location"),
      cache: res.headers.get("x-vercel-cache"),
    };
  } catch (err) {
    return {
      url,
      status: 0,
      ms: Date.now() - started,
      location: null,
      cache: null,
      error: err instanceof Error ? err.name : String(err),
    };
  }
}

async function main() {
  const urls = [
    ...new Set(
      fs
        .readFileSync(urlsPath, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("http")),
    ),
  ];
  console.log(`[rapport] ${urls.length} URL, concurrence ${concurrency}.`);

  const before = new Map<string, number>();
  if (beforeFile) {
    const rows: Array<{ url: string; status: number }> = JSON.parse(fs.readFileSync(beforeFile, "utf8"));
    for (const r of rows) before.set(r.url, r.status);
    console.log(`[rapport] ${before.size} codes de référence lus dans ${beforeFile}.`);
  }

  const results: Probe[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < urls.length) {
        const url = urls[cursor++];
        results.push(await probe(url));
        if (results.length % 50 === 0) console.log(`[rapport] ${results.length}/${urls.length}`);
      }
    }),
  );
  results.sort((a, b) => a.url.localeCompare(b.url));

  // Une redirection n'est vérifiée que si l'on regarde où elle mène. Chaque
  // destination distincte est sondée une fois, puis réutilisée.
  const destinations = new Map<string, number>();
  const targets = [...new Set(results.map((r) => r.location).filter((l): l is string => !!l))];
  for (const target of targets) {
    const absolute = target.startsWith("http") ? target : new URL(target, results[0].url).toString();
    destinations.set(target, (await probe(absolute)).status);
  }

  const csv = ["url,avant,apres,ms,cache,destination,code_destination"];
  for (const r of results) {
    const dest = r.location ?? "";
    csv.push(
      [
        r.url,
        before.get(r.url) ?? "",
        r.status || (r.error ?? "ERR"),
        r.ms,
        r.cache ?? "",
        dest,
        dest ? (destinations.get(dest) ?? "") : "",
      ]
        .map((c) => (String(c).includes(",") ? `"${c}"` : String(c)))
        .join(","),
    );
  }
  fs.writeFileSync(`${outBase}.csv`, csv.join("\n"));
  fs.writeFileSync(`${outBase}.json`, JSON.stringify(results, null, 2));

  const tally = (key: (r: Probe) => string) =>
    [...results.reduce((m, r) => m.set(key(r), (m.get(key(r)) ?? 0) + 1), new Map<string, number>())]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k}=${n}`)
      .join("  ");

  const ms = results.map((r) => r.ms).sort((a, b) => a - b);
  const pct = (q: number) => ms[Math.min(ms.length - 1, Math.floor(ms.length * q))];

  console.log("\n── Codes ──");
  console.log("  " + tally((r) => String(r.status || "ERR")));
  console.log("── Cache CDN ──");
  console.log("  " + tally((r) => r.cache ?? "absent"));
  console.log("── Temps de réponse ──");
  console.log(`  p50=${pct(0.5)} ms  p90=${pct(0.9)} ms  p99=${pct(0.99)} ms  max=${ms[ms.length - 1]} ms`);

  // Le contrôle qui ne se voit pas dans un total par code.
  const chains = results.filter((r) => r.location && (destinations.get(r.location) ?? 0) >= 400);
  if (chains.length) {
    console.log(`\n⚠ ${chains.length} redirection(s) vers une page en erreur :`);
    for (const r of chains) console.log(`  ${r.status} ${r.url} → ${destinations.get(r.location!)} ${r.location}`);
  } else {
    console.log("\n✓ Aucune redirection ne mène à une page en erreur.");
  }

  if (before.size) {
    const changed = results.filter((r) => before.has(r.url) && before.get(r.url) !== r.status);
    console.log(`\n${changed.length} URL ont changé de code depuis la mesure de référence.`);
  }

  console.log(`\n[rapport] ${outBase}.csv et ${outBase}.json écrits.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

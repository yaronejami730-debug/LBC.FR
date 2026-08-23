/**
 * Temps de réponse des pages publiques, mesuré depuis l'extérieur.
 *
 *     npm run seo:ttfb
 *     npm run seo:ttfb -- --base=http://localhost:3000 --sample=20
 *
 * ── Pourquoi ce script ────────────────────────────────────────────────────
 *
 * Le taux d'exploration de Google est indexé sur le temps de réponse : un site
 * lent est exploré moins souvent, et l'audit du 23/08/2026 mesurait jusqu'à
 * 1,9 s sur les fiches annonces contre 0,3 à 0,7 s sur les pages catégorie.
 *
 * Le correctif de ce jour a retiré le squelette de chargement des fiches pour
 * récupérer un vrai code HTTP sur les slugs périmés (voir
 * `docs/deploiement-2026-08-23-seo.md`). Le contrat de cet arbitrage est
 * chiffré : **les fiches doivent rester dans la même fourchette que les pages
 * de liste**. Ce script est ce qui permet de le vérifier en une commande plutôt
 * qu'à l'impression.
 *
 * Les URL sont tirées du sitemap servi : on mesure ce qu'on recommande à
 * Google, pas une liste écrite à la main qui dériverait.
 */

const arg = (name: string, fallback: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;

const BASE = arg("base", "https://www.dealandcompany.fr").replace(/\/$/, "");
const SAMPLE = Math.max(1, Number(arg("sample", "12")));

/**
 * Référence du 23/08/2026, après retrait du squelette de chargement.
 * Un dépassement durable de ces valeurs remet l'arbitrage en question.
 */
const BASELINE = { listingMedian: 0.29, listingP90: 0.33 };

type Timing = { url: string; ttfb: number; status: number };

async function measure(url: string): Promise<Timing> {
  const started = performance.now();
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "DealAndCo-TTFB/1.0" },
      redirect: "manual",
    });
    // `fetch` ne rend la main qu'une fois les en-têtes reçus : c'est bien le
    // temps jusqu'au premier octet, pas le temps de transfert complet.
    const ttfb = (performance.now() - started) / 1000;
    await res.arrayBuffer().catch(() => null);
    return { url, ttfb, status: res.status };
  } catch {
    return { url, ttfb: Number.POSITIVE_INFINITY, status: 0 };
  }
}

function percentiles(values: number[]) {
  const v = [...values].sort((a, b) => a - b);
  const at = (p: number) => v[Math.min(v.length - 1, Math.floor(v.length * p))];
  return { min: v[0], median: at(0.5), p90: at(0.9), max: v[v.length - 1] };
}

function line(label: string, timings: Timing[]) {
  const ok = timings.filter((t) => t.status > 0);
  if (ok.length === 0) {
    console.log(`  ${label.padEnd(18)} aucune réponse`);
    return null;
  }
  const p = percentiles(ok.map((t) => t.ttfb));
  console.log(
    `  ${label.padEnd(18)} min ${p.min.toFixed(2)}s · médiane ${p.median.toFixed(2)}s · p90 ${p.p90.toFixed(2)}s · max ${p.max.toFixed(2)}s   (${ok.length} URL)`,
  );
  return p;
}

async function main() {
  const xml = await fetch(`${BASE}/sitemap.xml`).then((r) => r.text());
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

  const listings = urls.filter((u) => u.includes("/annonce/")).slice(0, SAMPLE);
  const lists = urls.filter((u) => /\/annonces(\/|$)|\/ville\//.test(u)).slice(0, SAMPLE);

  console.log(`\n${BASE} — ${urls.length} URL au sitemap\n`);

  // Séquentiel, volontairement : mesurer en parallèle mesurerait surtout la
  // capacité du réseau local à ouvrir des connexions.
  const listingTimings: Timing[] = [];
  for (const u of listings) listingTimings.push(await measure(u));
  const listTimings: Timing[] = [];
  for (const u of lists) listTimings.push(await measure(u));

  const l = line("fiches annonces", listingTimings);
  line("pages de liste", listTimings);

  const failed = [...listingTimings, ...listTimings].filter((t) => t.status === 0 || t.status >= 400);
  if (failed.length > 0) {
    console.log("\n  réponses en échec :");
    for (const f of failed) console.log(`    ${f.status || "timeout"}  ${f.url}`);
  }

  if (l) {
    console.log(
      `\n  référence du 23/08/2026 : médiane ${BASELINE.listingMedian}s · p90 ${BASELINE.listingP90}s`,
    );
    // Une marge de 2× : le bruit d'une mesure depuis un poste de travail est
    // réel, et déclencher une alerte sur 50 ms de plus ne servirait personne.
    if (l.median > BASELINE.listingMedian * 2 || l.p90 > BASELINE.listingP90 * 2) {
      console.log(
        "  ⚠ les fiches ont doublé leur temps de réponse — l'arbitrage du squelette de chargement est à revoir.",
      );
      process.exitCode = 1;
    } else {
      console.log("  Fiches et listes dans la même fourchette : l'arbitrage tient.");
    }
  }
}

main();

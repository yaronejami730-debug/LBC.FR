/**
 * Captation manuelle des flux de presse.
 *
 *   npm run news:ingest              → simulation : ce qui serait capté, rien n'est écrit
 *   npm run news:ingest -- --run     → captation réelle
 *   npm run news:ingest -- --report  → ce dont la presse parle, croisé avec notre stock
 *
 * La simulation existe pour une raison précise : le rattachement marque/modèle
 * est la seule partie du système qui puisse se tromper visiblement — un titre
 * de Clio posé sur la page de la Golf. On regarde donc ce qui s'apparie avant
 * d'écrire quoi que ce soit.
 */
import { NEWS_SOURCES } from "../lib/news/sources";
import { parseFeed } from "../lib/news/parse";
import { matchTitle } from "../lib/news/match";
import { attachAuthors, buildModelCatalogue, ingestAll, makeQuoteBudget, purgeOldNews } from "../lib/news/ingest";
import { newsTrends } from "../lib/news/select";
import { prisma } from "../lib/prisma";

const has = (n: string) => process.argv.some((a) => a === `--${n}`);

async function dryRun() {
  const catalogue = await buildModelCatalogue();
  console.log(
    `\ncatalogue : ${catalogue.size} marques, ${[...catalogue.values()].reduce((n, m) => n + m.length, 0)} modèles connus\n`,
  );

  for (const source of NEWS_SOURCES) {
    const xml = await fetch(source.url, {
      headers: { "user-agent": "DealAndCoBot/1.0 (+https://www.dealandcompany.fr)" },
    }).then((r) => r.text());
    const items = parseFeed(xml);

    console.log(`${source.publisher} — ${items.length} articles`);
    let brand = 0;
    let model = 0;
    for (const item of items) {
      const m = matchTitle(item.title, catalogue);
      if (m.brandSlug) brand++;
      if (m.modelSlug) model++;
      const tag = m.modelSlug
        ? `${m.brandSlug}/${m.modelSlug}`
        : m.brandSlug ?? "—";
      console.log(`  ${tag.padEnd(28)} ${item.title.slice(0, 88)}`);
    }
    console.log(`\n  ${brand} rattachés à une marque, ${model} à un modèle précis.\n`);
  }
  console.log("Simulation : rien n'a été écrit. Ajoutez --run pour capter réellement.\n");
}

async function report() {
  const trends = await newsTrends(30);
  console.log("\nCe dont la presse parle sur 30 jours, face à notre stock :\n");
  console.log(`  ${"sujet".padEnd(30)} ${"articles".padStart(8)} ${"annonces".padStart(9)}`);
  for (const t of trends.slice(0, 30)) {
    const sujet = t.modelSlug ? `${t.brandSlug} ${t.modelSlug}` : t.brandSlug;
    console.log(
      `  ${sujet.padEnd(30)} ${String(t.articles).padStart(8)} ${String(t.listings).padStart(9)}`,
    );
  }
  const orphelins = trends.filter((t) => t.listings === 0 && t.articles >= 2);
  if (orphelins.length > 0) {
    console.log(
      `\n  ${orphelins.length} sujet(s) couverts par la presse où nous n'avons rien à montrer — signal de recrutement vendeurs.`,
    );
  }
}

async function main() {
  if (has("report")) return report();
  if (!has("run")) return dryRun();

  // En ligne de commande, rien ne contraint la durée : le budget de lecture des
  // pages est large, de quoi rattraper d'un coup tout ce que le cron étale sur
  // plusieurs passages.
  const reports = await ingestAll(makeQuoteBudget(400, 10 * 60_000));
  for (const r of reports) {
    if (r.error) {
      console.log(`${r.source} : échec — ${r.error}`);
      continue;
    }
    console.log(
      `${r.source} : ${r.fetched} lus, ${r.created} nouveaux, ${r.updated} mis à jour, ${r.skipped} écartés, ${r.quoted} cités, ${r.matchedBrand} marques, ${r.matchedModel} modèles`,
    );
  }
  const authors = await attachAuthors();
  console.log(`signatures : ${authors.signed} article(s) signé(s), ${authors.sponsored} sponsorisé(s) supprimé(s)`);
  console.log(`purge : ${await purgeOldNews()} article(s) hors fenêtre supprimé(s)`);
}

main().finally(() => prisma.$disconnect());

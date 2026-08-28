/**
 * Tri des URL en 404 : lesquelles Google a-t-il réellement servies ?
 *
 *   npm run seo:404-triage -- --file=/chemin/probe-results.json
 *
 * ── Pourquoi ce script ────────────────────────────────────────────────────
 *
 * Supprimer une section laisse derrière elle des URL que Google connaît encore.
 * Deux traitements existent, et le choix entre les deux n'est pas une question
 * de goût : une URL qui a reçu des clics porte des liens et de l'historique,
 * elle mérite une 301 vers l'équivalent le plus proche ; une URL qui n'a jamais
 * rien reçu ne mérite qu'une 410, qui dit à Google « n'y reviens pas » au lieu
 * du « peut-être plus tard » d'une 404.
 *
 * Se tromper de sens coûte dans les deux directions : rediriger en masse des
 * pages sans valeur vers une catégorie fabrique du contenu trompeur (Google
 * traite ces redirections comme des soft-404), et supprimer une page qui
 * recevait du trafic jette l'antériorité acquise.
 *
 * Le script demande donc à Search Console, sur seize mois, ce que chaque URL a
 * réellement produit — clics, impressions, position — et classe. Il ne décide
 * rien tout seul : il écrit un rapport que l'on relit avant d'écrire la moindre
 * règle de redirection.
 */

import fs from "node:fs";
import { querySearchAnalytics, SITE_URL } from "../lib/seo/search-console";

const args = process.argv.slice(2);
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];

const file = flag("file");
if (!file) {
  console.error("Usage: --file=<probe-results.json>  (objets { url, status })");
  process.exit(1);
}
// `process.exit` ne suffit pas à TypeScript pour éliminer `undefined` : la
// constante est réaffirmée non nulle une fois, ici, plutôt qu'à chaque usage.
const inputFile: string = file;

/** Search Console accuse ~3 jours de latence ; la fenêtre s'arrête donc à J-3. */
function shiftDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Probe = { url: string; status: number };

async function main() {
  if (!SITE_URL) throw new Error("SEARCH_CONSOLE_SITE_URL manquant");

  const probes: Probe[] = JSON.parse(fs.readFileSync(inputFile, "utf8"));
  const broken = new Set(probes.filter((p) => p.status === 404 || p.status === 410).map((p) => p.url));
  console.log(`[triage] ${broken.size} URL en 404/410 à trier.`);

  // Seize mois : c'est tout l'historique que l'API conserve. Une page morte
  // depuis six mois n'apparaîtrait pas dans une fenêtre de 90 jours, et on la
  // classerait « sans valeur » à tort.
  const startDate = shiftDate(-480);
  const endDate = shiftDate(-3);

  // On rapatrie toutes les pages de la propriété plutôt que d'interroger URL par
  // URL : 412 requêtes filtrées coûteraient 412 allers-retours et se feraient
  // limiter, là où la pagination lit le même corpus en quelques appels.
  const rows: Awaited<ReturnType<typeof querySearchAnalytics>> = [];
  for (let startRow = 0; ; startRow += 25000) {
    const page = await querySearchAnalytics({
      startDate,
      endDate,
      dimensions: ["page"],
      rowLimit: 25000,
      startRow,
    });
    rows.push(...page);
    console.log(`[triage] ${rows.length} lignes lues…`);
    if (page.length < 25000) break;
  }

  const perf = new Map(rows.map((r) => [r.keys[0], r]));

  const withTraffic: typeof rows = [];
  const impressionsOnly: typeof rows = [];
  const silent: string[] = [];

  for (const url of broken) {
    const row = perf.get(url);
    if (!row) {
      silent.push(url);
    } else if (row.clicks > 0) {
      withTraffic.push(row);
    } else {
      impressionsOnly.push(row);
    }
  }

  const bySize = (a: { clicks: number; impressions: number }, b: { clicks: number; impressions: number }) =>
    b.clicks - a.clicks || b.impressions - a.impressions;

  console.log(`\n── Bilan (${startDate} → ${endDate}) ──`);
  console.log(`  clics > 0        ${withTraffic.length}   → 301 vers l'équivalent le plus proche`);
  console.log(`  impressions seul ${impressionsOnly.length}   → arbitrage manuel`);
  console.log(`  jamais servies   ${silent.length}   → 410 Gone`);

  if (withTraffic.length) {
    console.log("\n── URL ayant reçu des clics ──");
    for (const r of withTraffic.sort(bySize)) {
      console.log(`  ${String(r.clicks).padStart(5)} clics ${String(r.impressions).padStart(7)} impr  pos ${r.position.toFixed(1).padStart(5)}  ${r.keys[0]}`);
    }
  }

  if (impressionsOnly.length) {
    console.log("\n── URL avec impressions, zéro clic ──");
    for (const r of impressionsOnly.sort(bySize)) {
      console.log(`  ${String(r.impressions).padStart(7)} impr  pos ${r.position.toFixed(1).padStart(5)}  ${r.keys[0]}`);
    }
  }

  const out = inputFile.replace(/\.json$/, "") + "-triage.json";
  fs.writeFileSync(
    out,
    JSON.stringify({ window: { startDate, endDate }, withTraffic, impressionsOnly, silent }, null, 2),
  );
  console.log(`\n[triage] rapport → ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

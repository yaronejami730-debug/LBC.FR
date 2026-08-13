/**
 * Distribution des motifs d'exclusion des annonces.
 *
 *   npm run seo:exclusions
 *   npm run seo:exclusions -- --url=/annonce/cmpfqx03v001d04l5y6xc8emy/audi-q5-...
 *   npm run seo:exclusions -- --id=cmpfqx03v001d04l5y6xc8emy
 *
 * ── La question posée ─────────────────────────────────────────────────────
 *
 * 53 annonces indexables sur 213 : trois quarts du stock écarté. Avant de
 * toucher aux seuils, il faut savoir **pourquoi**, et la réponse change
 * complètement la suite :
 *
 *   — si le motif dominant est réparable côté produit (description trop courte,
 *     photos manquantes), le levier n'est pas SEO, il est dans le formulaire de
 *     publication : minimum de caractères, compteur en direct, incitation à
 *     ajouter des photos. C'est de loin le plus gros gisement de volume ;
 *
 *   — si les seuils sont simplement trop stricts, on recalibre — en gardant un
 *     plancher qui écarte réellement les annonces vides, sinon on remplace un
 *     problème de volume par un problème de qualité.
 *
 * Deviner entre les deux coûte plus cher que de mesurer. D'où ce script.
 *
 * ── Ce qu'il affiche ──────────────────────────────────────────────────────
 *
 *   — la distribution des motifs, en absolu et en part du stock écarté ;
 *   — le **motif seul** de chaque annonce quand il n'y en a qu'un : c'est là
 *     que se cache le gisement, une annonce à un seul motif est à un geste de
 *     l'index ;
 *   — la distribution des scores, pour distinguer « à deux photos de l'index »
 *     de « n'y sera jamais » ;
 *   — le détail d'une annonce précise avec `--id` ou `--url`.
 */

import { prisma } from "../lib/prisma";
import {
  evaluateListing,
  EXCLUSION_LABELS,
  type ExclusionReason,
  type IndexVerdict,
} from "../lib/seo/indexability";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const SELECT = {
  id: true,
  title: true,
  description: true,
  images: true,
  metadata: true,
  price: true,
  category: true,
  subcategory: true,
  location: true,
  condition: true,
  status: true,
  shadowBanned: true,
  deletedAt: true,
  qualityScore: true,
  reportCount: true,
  imageDupCount: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { isPro: true } },
} as const;

type Row = Awaited<ReturnType<typeof fetchRows>>[number];

function fetchRows() {
  return prisma.listing.findMany({
    where: { status: "APPROVED", shadowBanned: false, deletedAt: null } as any,
    select: SELECT,
    take: 50_000,
  });
}

function verdictOf(row: Row): IndexVerdict {
  return evaluateListing({
    id: row.id,
    title: row.title,
    description: row.description,
    images: row.images,
    metadata: row.metadata,
    price: row.price,
    category: row.category,
    subcategory: row.subcategory,
    location: row.location,
    condition: row.condition,
    status: row.status,
    shadowBanned: row.shadowBanned,
    deletedAt: row.deletedAt,
    qualityScore: row.qualityScore,
    reportCount: row.reportCount,
    imageDupCount: row.imageDupCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isPro: !!row.user?.isPro,
  });
}

function bar(value: number, total: number, width = 30): string {
  const filled = total > 0 ? Math.round((value / total) * width) : 0;
  return "█".repeat(filled).padEnd(width, "·");
}

async function inspectOne(id: string) {
  const row = await prisma.listing.findUnique({ where: { id }, select: SELECT });
  if (!row) {
    console.log(`Annonce ${id} introuvable.`);
    return;
  }
  const verdict = verdictOf(row);
  const images = (() => {
    try {
      return JSON.parse(row.images) as unknown[];
    } catch {
      return [];
    }
  })();

  console.log(`\n── ${row.title} ──`);
  console.log(`  id            ${row.id}`);
  console.log(`  compte        ${row.user?.isPro ? "professionnel" : "particulier"}`);
  console.log(`  description   ${row.description?.trim().length ?? 0} caractères`);
  console.log(`  photos        ${images.length}`);
  console.log(`  qualityScore  ${row.qualityScore ?? "—"}`);
  console.log(`  signalements  ${row.reportCount ?? 0}`);
  console.log(`  photos dupl.  ${row.imageDupCount ?? 0}`);
  console.log(`  ville résolue ${verdict.citySlug ?? "aucune"}`);
  console.log(`\n  indexable     ${verdict.indexable ? "OUI" : "NON"}`);
  console.log(`  score         ${verdict.score}/100`);
  if (verdict.reasons.length > 0) {
    console.log(`  motifs        ${verdict.reasons.map((r) => EXCLUSION_LABELS[r]).join(" · ")}`);
  }
  console.log(`\n  détail du score :`);
  for (const [key, value] of Object.entries(verdict.breakdown)) {
    console.log(`    ${key.padEnd(24)} ${String(value).padStart(4)}`);
  }
}

async function main() {
  const single = flag("id") ?? flag("url")?.split("/")[2];
  if (single) {
    await inspectOne(single);
    await prisma.$disconnect();
    return;
  }

  const rows = await fetchRows();
  const verdicts = rows.map((row) => ({ row, verdict: verdictOf(row) }));

  const indexable = verdicts.filter((v) => v.verdict.indexable);
  const excluded = verdicts.filter((v) => !v.verdict.indexable);

  console.log(`\n── Stock ──`);
  console.log(`  publiées et visibles   ${rows.length}`);
  console.log(`  indexables             ${indexable.length}`);
  console.log(`  écartées               ${excluded.length}`);

  // ── Distribution des motifs ───────────────────────────────────────────────
  //
  // Une annonce peut cumuler plusieurs motifs : le total des lignes dépasse
  // donc le nombre d'annonces écartées, et c'est normal.
  const byReason = new Map<ExclusionReason, number>();
  for (const { verdict } of excluded) {
    for (const reason of verdict.reasons) {
      byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
    }
  }

  console.log(`\n── Motifs d'exclusion (une annonce peut en cumuler) ──`);
  for (const [reason, n] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
    const pct = excluded.length ? Math.round((n / excluded.length) * 100) : 0;
    console.log(`  ${bar(n, excluded.length)} ${String(n).padStart(4)} ${String(pct).padStart(3)}%  ${EXCLUSION_LABELS[reason]}`);
  }

  // ── Le gisement : les annonces à un seul motif ────────────────────────────
  //
  // Ce sont elles qui comptent. Une annonce à un seul motif est à un geste de
  // l'index — souvent un geste que le vendeur ferait volontiers si le
  // formulaire le lui demandait au bon moment.
  const soleReason = new Map<ExclusionReason, number>();
  for (const { verdict } of excluded) {
    if (verdict.reasons.length === 1) {
      const reason = verdict.reasons[0];
      soleReason.set(reason, (soleReason.get(reason) ?? 0) + 1);
    }
  }
  const soleTotal = [...soleReason.values()].reduce((a, b) => a + b, 0);

  console.log(`\n── Motif unique — annonces à un geste de l'index (${soleTotal}) ──`);
  for (const [reason, n] of [...soleReason.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${bar(n, soleTotal)} ${String(n).padStart(4)}  ${EXCLUSION_LABELS[reason]}`);
  }

  // ── Écart au seuil, pour les deux motifs réparables ───────────────────────
  //
  // « Trop courte » ne dit pas de combien. Il n'en faut pas moins savoir si le
  // stock est à vingt caractères du seuil ou à deux cents : la première
  // situation se règle par un compteur dans le formulaire, la seconde non.
  const descLengths = excluded
    .filter(({ verdict }) => verdict.reasons.includes("DESCRIPTION_TROP_COURTE"))
    .map(({ row }) => row.description?.trim().length ?? 0)
    .sort((a, b) => a - b);

  if (descLengths.length > 0) {
    const median = descLengths[Math.floor(descLengths.length / 2)];
    console.log(`\n── Descriptions trop courtes (${descLengths.length}) ──`);
    console.log(`  médiane ${median} caractères — min ${descLengths[0]}, max ${descLengths[descLengths.length - 1]}`);
    for (const [from, to] of [[0, 50], [50, 100], [100, 180], [180, 250]] as const) {
      const n = descLengths.filter((l) => l >= from && l < to).length;
      console.log(`  ${String(from).padStart(4)}–${String(to).padEnd(4)} ${bar(n, descLengths.length)} ${n}`);
    }
  }

  const photoCounts = excluded
    .filter(({ verdict }) => verdict.reasons.includes("PAS_ASSEZ_DE_PHOTOS"))
    .map(({ row }) => {
      try {
        const parsed = JSON.parse(row.images);
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        return 0;
      }
    });

  if (photoCounts.length > 0) {
    console.log(`\n── Photos insuffisantes (${photoCounts.length}) ──`);
    for (const n of [0, 1, 2]) {
      const count = photoCounts.filter((c) => c === n).length;
      console.log(`  ${n} photo${n > 1 ? "s" : ""}  ${bar(count, photoCounts.length)} ${count}`);
    }
  }

  // ── Distribution des scores ───────────────────────────────────────────────
  console.log(`\n── Scores des annonces écartées ──`);
  const scores = excluded.map((v) => v.verdict.score);
  for (const [from, to] of [[0, 20], [20, 40], [40, 60], [60, 80], [80, 101]] as const) {
    const n = scores.filter((s) => s >= from && s < to).length;
    console.log(`  ${String(from).padStart(3)}–${String(to - 1).padEnd(3)} ${bar(n, scores.length)} ${n}`);
  }

  console.log(
    `\n  Lecture : au-dessus de 40, l'annonce est proche du seuil — le motif est ` +
      `réparable côté produit. En dessous de 20, elle est vide et doit le rester.\n`,
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

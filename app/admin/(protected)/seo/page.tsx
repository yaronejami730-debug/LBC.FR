/**
 * Tableau de bord indexation.
 *
 * Il remplace un écran qui affichait « 362 en file d'attente, 0 soumise » sans
 * pouvoir expliquer ni l'un ni l'autre. Trois principes tenus ici :
 *
 *   1. **Rien n'est déduit.** Un chiffre affiché correspond à une ligne en base
 *      ou à une réponse de Google. Aucune projection, aucune estimation.
 *   2. **Notre verdict et celui de Google sont séparés visuellement.** Nous
 *      décidons ce que nous recommandons ; Google décide ce qu'il indexe. Les
 *      confondre est exactement ce qui rendait l'ancien écran inutile.
 *   3. **Chaque exclusion porte son motif.** « Pourquoi cette annonce n'est pas
 *      dans Google » doit se lire en une ligne, sans ouvrir le code.
 */

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EXCLUSION_LABELS, type ExclusionReason } from "@/lib/seo/indexability";

export const dynamic = "force-dynamic";
export const metadata = { title: "Indexation SEO — Admin" };

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente d'analyse",
  ELIGIBLE: "Éligible — recommandée à Google",
  EXCLUDED: "Exclue par nos règles",
  SUBMITTED: "Envoyée à IndexNow (Bing/Yandex)",
  DISCOVERED: "Découverte par Google, pas encore explorée",
  CRAWLED: "Explorée par Google, pas indexée",
  INDEXED: "Indexée par Google",
  NOT_INDEXED: "Écartée par Google",
  ERROR: "Erreur de traitement",
  GONE: "Retirée du site",
};

const STATUS_TONE: Record<string, string> = {
  INDEXED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ELIGIBLE: "bg-sky-50 text-sky-700 border-sky-200",
  CRAWLED: "bg-amber-50 text-amber-700 border-amber-200",
  DISCOVERED: "bg-amber-50 text-amber-700 border-amber-200",
  NOT_INDEXED: "bg-rose-50 text-rose-700 border-rose-200",
  EXCLUDED: "bg-slate-100 text-slate-600 border-slate-200",
  GONE: "bg-slate-100 text-slate-500 border-slate-200",
  ERROR: "bg-rose-50 text-rose-700 border-rose-200",
  PENDING: "bg-slate-100 text-slate-600 border-slate-200",
  SUBMITTED: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const TYPE_LABELS: Record<string, string> = {
  LISTING: "Annonces",
  CATEGORY: "Catégories",
  SUBCATEGORY: "Sous-catégories",
  CITY: "Villes",
  CATEGORY_CITY: "Catégorie × ville",
  BRAND: "Marques / modèles",
  PRO: "Fiches pro",
  EDITORIAL: "Éditorial",
  BLOG: "Blog",
  STATIC: "Pages fixes",
};

function Card({
  label,
  value,
  hint,
  tone = "text-[#1a1b25]",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default async function AdminSeoPage() {
  const since24h = new Date(Date.now() - 86_400_000);
  const since7d = new Date(Date.now() - 7 * 86_400_000);

  const [
    total,
    byStatus,
    byType,
    indexableCount,
    inSitemapCount,
    scoreAgg,
    new24h,
    new7d,
    updated7d,
    goneCount,
    errorCount,
    lastRuns,
    worst,
    best,
    excludedSample,
    canonicalMismatch,
  ] = await Promise.all([
    prisma.seoUrl.count(),
    prisma.seoUrl.groupBy({ by: ["status"], _count: true }),
    prisma.seoUrl.groupBy({ by: ["type"], _count: true }),
    prisma.seoUrl.count({ where: { indexable: true } }),
    prisma.seoUrl.count({ where: { inSitemap: true } }),
    prisma.seoUrl.aggregate({ where: { indexable: true }, _avg: { score: true } }),
    prisma.seoUrl.count({ where: { firstSeenAt: { gte: since24h } } }),
    prisma.seoUrl.count({ where: { firstSeenAt: { gte: since7d } } }),
    prisma.seoUrl.count({ where: { contentUpdatedAt: { gte: since7d } } }),
    prisma.seoUrl.count({ where: { status: "GONE" } }),
    prisma.seoUrl.count({ where: { lastError: { not: null } } }),
    prisma.seoJobRun.findMany({ orderBy: { startedAt: "desc" }, take: 5 }),
    prisma.seoUrl.findMany({
      where: { type: "LISTING", indexable: false, status: { not: "GONE" } },
      orderBy: { score: "desc" },
      take: 12,
      select: { url: true, path: true, score: true, exclusionReasons: true },
    }),
    prisma.seoUrl.findMany({
      where: { indexable: true },
      orderBy: { score: "desc" },
      take: 8,
      select: { path: true, score: true, status: true, coverageState: true },
    }),
    prisma.seoUrl.groupBy({
      by: ["exclusionReasons"],
      where: { indexable: false, status: { not: "GONE" } },
      _count: true,
    }),
    prisma.seoUrl.count({
      where: {
        googleCanonical: { not: null },
        canonical: { not: null },
        NOT: { googleCanonical: { equals: prisma.seoUrl.fields.canonical } },
      },
    }).catch(() => 0),
  ]);

  const statusCount = (status: string) =>
    byStatus.find((row) => row.status === status)?._count ?? 0;

  // Les motifs sont stockés en tableau JSON : on les répartit ici plutôt que
  // d'ajouter une table de jointure pour une donnée purement consultative.
  const reasonTotals = new Map<ExclusionReason, number>();
  for (const row of excludedSample) {
    let reasons: ExclusionReason[] = [];
    try {
      reasons = JSON.parse(row.exclusionReasons);
    } catch {
      reasons = [];
    }
    for (const reason of reasons) {
      reasonTotals.set(reason, (reasonTotals.get(reason) ?? 0) + row._count);
    }
  }

  const googleKnown =
    statusCount("INDEXED") +
    statusCount("CRAWLED") +
    statusCount("DISCOVERED") +
    statusCount("NOT_INDEXED");

  const lastSync = lastRuns.find((r) => r.job === "queue-sync");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-[#1a1b25]">Indexation SEO</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Ce que nous recommandons à Google, et ce que Google en fait. Les deux
          ne se confondent jamais : nous décidons ce qui entre au sitemap, Google
          décide ce qu'il explore et indexe.
        </p>
      </div>

      {total === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-bold">File vide — la synchronisation n'a jamais tourné.</p>
          <p className="mt-1">
            Elle s'exécute chaque jour à 6 h (<code>/api/cron/seo-queue</code>). Pour la
            déclencher immédiatement :{" "}
            <code className="rounded bg-white/70 px-1">
              curl -H &quot;Authorization: Bearer $CRON_SECRET&quot;
              https://www.dealandcompany.fr/api/cron/seo-queue
            </code>
          </p>
        </div>
      )}

      {/* ── Notre verdict ───────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-400">
          Notre verdict
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card label="URL connues" value={total} hint="Toutes pages publiques confondues" />
          <Card
            label="Indexables"
            value={indexableCount}
            tone="text-emerald-600"
            hint="Passent nos règles de qualité"
          />
          <Card
            label="Exclues"
            value={total - indexableCount - goneCount}
            tone="text-slate-500"
            hint="Motif détaillé plus bas"
          />
          <Card
            label="Dans le sitemap"
            value={inSitemapCount}
            hint="Doit égaler le nombre d'indexables"
          />
          <Card
            label="Score moyen"
            value={Math.round(scoreAgg._avg.score ?? 0)}
            hint="Sur les URL indexables, 0-100"
          />
          <Card label="Nouvelles 24 h" value={new24h} />
          <Card label="Nouvelles 7 j" value={new7d} hint={`${updated7d} modifiées`} />
          <Card
            label="Retirées"
            value={goneCount}
            tone="text-slate-500"
            hint="Sorties du site, conservées pour l'historique"
          />
        </div>
        {inSitemapCount !== indexableCount && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Écart entre indexables ({indexableCount}) et sitemap ({inSitemapCount}) — les
            deux doivent coïncider. Relancer la synchronisation.
          </p>
        )}
      </section>

      {/* ── Verdict de Google ───────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-400">
          Verdict de Google <span className="normal-case font-medium">(API URL Inspection, lecture seule)</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card label="Indexées" value={statusCount("INDEXED")} tone="text-emerald-600" />
          <Card
            label="Explorées, non indexées"
            value={statusCount("CRAWLED")}
            tone="text-amber-600"
            hint="Google a lu la page et ne l'a pas retenue"
          />
          <Card
            label="Découvertes, non explorées"
            value={statusCount("DISCOVERED")}
            tone="text-amber-600"
            hint="Connue mais jamais téléchargée"
          />
          <Card label="Écartées" value={statusCount("NOT_INDEXED")} tone="text-rose-600" />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {googleKnown === 0
            ? "Aucun relevé pour l'instant. L'API Search Console doit être activée sur le projet Google Cloud, et le compte de service ajouté comme utilisateur de la propriété."
            : `${googleKnown} URL relevées auprès de Google. Aucune API ne permet de forcer l'indexation : l'Indexing API officielle est restreinte aux offres d'emploi et aux retransmissions.`}
          {canonicalMismatch > 0 &&
            ` ${canonicalMismatch} URL pour lesquelles Google retient une canonique différente de la nôtre.`}
        </p>
      </section>

      {/* ── Répartition par type ────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-400">
          Par type de page
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3 font-bold">Type</th>
                <th className="px-4 py-3 text-right font-bold">URL</th>
              </tr>
            </thead>
            <tbody>
              {byType
                .sort((a, b) => b._count - a._count)
                .map((row) => (
                  <tr key={row.type} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-semibold text-slate-700">
                      {TYPE_LABELS[row.type] ?? row.type}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                      {row._count}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Statuts détaillés ───────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-400">
          Statuts
        </h2>
        <div className="flex flex-wrap gap-2">
          {byStatus
            .sort((a, b) => b._count - a._count)
            .map((row) => (
              <span
                key={row.status}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  STATUS_TONE[row.status] ?? "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {STATUS_LABELS[row.status] ?? row.status} · {row._count}
              </span>
            ))}
        </div>
      </section>

      {/* ── Motifs d'exclusion ──────────────────────────────────────────── */}
      {reasonTotals.size > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-400">
            Pourquoi des pages sont écartées
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-bold">Motif</th>
                  <th className="px-4 py-3 text-right font-bold">URL</th>
                </tr>
              </thead>
              <tbody>
                {[...reasonTotals.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([reason, count]) => (
                    <tr key={reason} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2.5 text-slate-700">
                        {EXCLUSION_LABELS[reason] ?? reason}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                        {count}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Annonces les plus proches du seuil ──────────────────────────── */}
      {worst.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-black uppercase tracking-wider text-slate-400">
            À deux doigts de l'index
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Annonces exclues au score le plus élevé : ce sont celles où une photo ou
            quelques lignes de description suffisent à faire basculer la page.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-bold">Page</th>
                  <th className="px-4 py-3 text-right font-bold">Score</th>
                  <th className="px-4 py-3 font-bold">Ce qui manque</th>
                </tr>
              </thead>
              <tbody>
                {worst.map((row) => {
                  let reasons: ExclusionReason[] = [];
                  try {
                    reasons = JSON.parse(row.exclusionReasons);
                  } catch {
                    reasons = [];
                  }
                  return (
                    <tr key={row.url} className="border-b border-slate-50 last:border-0">
                      <td className="max-w-[22rem] truncate px-4 py-2.5">
                        <Link
                          href={row.path}
                          target="_blank"
                          className="text-sky-700 hover:underline"
                        >
                          {row.path}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-700">
                        {row.score}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {reasons.map((r) => EXCLUSION_LABELS[r] ?? r).join(" · ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Meilleures pages ────────────────────────────────────────────── */}
      {best.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-400">
            Meilleures pages
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-bold">Page</th>
                  <th className="px-4 py-3 text-right font-bold">Score</th>
                  <th className="px-4 py-3 font-bold">État Google</th>
                </tr>
              </thead>
              <tbody>
                {best.map((row) => (
                  <tr key={row.path} className="border-b border-slate-50 last:border-0">
                    <td className="max-w-[22rem] truncate px-4 py-2.5">
                      <Link href={row.path} target="_blank" className="text-sky-700 hover:underline">
                        {row.path}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-700">
                      {row.score}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {row.coverageState ?? STATUS_LABELS[row.status] ?? row.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Journal ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-400">
          Dernières exécutions
        </h2>
        {lastRuns.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune exécution enregistrée.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-bold">Travail</th>
                  <th className="px-4 py-3 font-bold">Début</th>
                  <th className="px-4 py-3 text-right font-bold">URL</th>
                  <th className="px-4 py-3 font-bold">Résultat</th>
                </tr>
              </thead>
              <tbody>
                {lastRuns.map((run) => (
                  <tr key={run.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-semibold text-slate-700">{run.job}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {run.startedAt.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                      {run.processed}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {run.finishedAt === null ? (
                        <span className="text-amber-600">en cours</span>
                      ) : run.ok ? (
                        <span className="text-emerald-600">terminé</span>
                      ) : (
                        <span className="text-rose-600">{run.error ?? "échec"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {errorCount > 0 && (
          <p className="mt-3 text-xs text-rose-600">
            {errorCount} URL portent une erreur de traitement — colonne <code>lastError</code>.
          </p>
        )}
        {lastSync && (
          <p className="mt-2 text-xs text-slate-500">
            Dernière synchronisation complète : {lastSync.startedAt.toLocaleString("fr-FR")}.
          </p>
        )}
      </section>
    </div>
  );
}

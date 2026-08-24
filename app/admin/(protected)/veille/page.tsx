import { newsTrends } from "@/lib/news/select";
import { feedHealth } from "@/lib/news/articles";
import FeedStatus from "./FeedStatus";
import { prisma } from "@/lib/prisma";
import { NEWS_SOURCES } from "@/lib/news/sources";

export const metadata = { title: "Veille presse" };
export const dynamic = "force-dynamic";

const dateFr = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

/**
 * Veille presse — ce dont les médias parlent, face à ce que nous avons en rayon.
 *
 * ── À quoi cet écran sert vraiment ────────────────────────────────────────
 *
 * Pas à lire l'actualité : à décider quoi écrire. Le croisement se lit en deux
 * colonnes et donne deux décisions différentes :
 *
 *   · **beaucoup d'articles, du stock chez nous** → le sujet éditorial de la
 *     semaine. La demande existe, et nous avons de quoi y répondre ;
 *   · **beaucoup d'articles, zéro annonce** → pas un sujet à écrire, un signal
 *     de recrutement vendeurs. Publier une page sur un modèle dont nous n'avons
 *     rien reviendrait à faire venir un visiteur devant une étagère vide.
 *
 * Les titres eux-mêmes ne sont pas republiés ici non plus : cet écran compte,
 * il ne recopie pas.
 */
export default async function AdminVeillePage() {
  const [trends, total, dernier, feeds] = await Promise.all([
    newsTrends(30),
    prisma.newsItem.count(),
    prisma.newsItem.findFirst({ orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
    feedHealth(),
  ]);

  // Le cron passe toutes les heures : au-delà de deux, le flux est en panne.
  const STALE_MS = 2 * 3600 * 1000;
  const dateHeure = (d: Date | null) =>
    d
      ? d.toLocaleString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Paris",
        })
      : "jamais";

  const aEcrire = trends.filter((t) => t.articles >= 2 && t.listings > 0);
  const aRecruter = trends.filter((t) => t.articles >= 2 && t.listings === 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2f6fb8]">Acquisition</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Veille presse</h1>
        <p className="text-sm text-slate-500 mt-1">
          {total} article{total > 1 ? "s" : ""} en base, {NEWS_SOURCES.length} flux suivis
          {dernier ? ` · dernière captation le ${dateFr(dernier.fetchedAt)}` : " · aucune captation"}.
        </p>
      </header>

      {/* ── État des flux ────────────────────────────────────────────────
          Un flux branché laisse deux traces qu'on ne peut pas simuler : une
          heure de dernière lecture qui avance à chaque passage, et un dernier
          article dont la date suit ce que le média publie. */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">État des flux</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Captation automatique toutes les heures. Un flux lu il y a plus de deux
              heures est en panne.
            </p>
          </div>
          <FeedStatus />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-semibold">Flux</th>
                <th className="py-2 pr-3 font-semibold">Rubrique</th>
                <th className="py-2 pr-3 text-right font-semibold">Articles</th>
                <th className="py-2 pr-3 font-semibold">Dernière lecture</th>
                <th className="py-2 pr-3 font-semibold">Dernier article</th>
                <th className="py-2 font-semibold">État</th>
              </tr>
            </thead>
            <tbody>
              {feeds.map((f) => {
                const stale =
                  !f.lastFetch || Date.now() - f.lastFetch.getTime() > STALE_MS;
                return (
                  <tr key={f.key} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3">
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener"
                        className="font-medium text-[#2f6fb8] hover:underline"
                      >
                        {f.key}
                      </a>
                      <span className="ml-2 text-xs text-slate-400">{f.publisher}</span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{f.section}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                      {f.articles}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">
                      {dateHeure(f.lastFetch)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">
                      {dateHeure(f.lastArticle)}
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          stale ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {stale ? "à vérifier" : "connecté"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {total === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Aucun article capté pour l&apos;instant. Le cron passe deux fois par jour ; en
          attendant, <code className="rounded bg-slate-100 px-1">npm run news:ingest -- --run</code>.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-slate-900">À écrire cette semaine</h2>
            <p className="mt-1 text-xs text-slate-500">
              La presse en parle et nous avons des annonces à montrer.
            </p>
            <ul className="mt-3 space-y-2">
              {aEcrire.slice(0, 12).map((t) => (
                <li key={`${t.brandSlug}/${t.modelSlug ?? ""}`} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-800">
                    {t.brandSlug}
                    {t.modelSlug ? ` ${t.modelSlug}` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {t.articles} art. · {t.listings} annonce{t.listings > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
              {aEcrire.length === 0 && (
                <li className="text-sm text-slate-500">Rien qui remplisse les deux conditions ce mois-ci.</li>
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-slate-900">Demande sans stock</h2>
            <p className="mt-1 text-xs text-slate-500">
              Sujets couverts par la presse où nous n&apos;avons rien en ligne.
            </p>
            <ul className="mt-3 space-y-2">
              {aRecruter.slice(0, 12).map((t) => (
                <li key={`${t.brandSlug}/${t.modelSlug ?? ""}`} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-800">
                    {t.brandSlug}
                    {t.modelSlug ? ` ${t.modelSlug}` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{t.articles} art.</span>
                </li>
              ))}
              {aRecruter.length === 0 && (
                <li className="text-sm text-slate-500">Aucun sujet orphelin.</li>
              )}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

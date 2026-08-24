import { newsTrends } from "@/lib/news/select";
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
  const [trends, total, dernier] = await Promise.all([
    newsTrends(30),
    prisma.newsItem.count(),
    prisma.newsItem.findFirst({ orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
  ]);

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

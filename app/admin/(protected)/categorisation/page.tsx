import { prisma } from "@/lib/prisma";
import { indexStats } from "@/lib/category/engine";
import CategoryDebugger from "./CategoryDebugger";

export const metadata = { title: "Catégorisation" };
export const dynamic = "force-dynamic";

/**
 * Diagnostic de la catégorisation.
 *
 * Deux questions, deux blocs : « pourquoi ce titre a-t-il donné cette
 * catégorie ? », et « sur quoi le moteur se trompe-t-il souvent ? ». La
 * seconde vient des corrections réelles des utilisateurs — le seul signal
 * fiable sur la qualité d'un classifieur.
 */
export default async function CategorisationPage() {
  const stats = indexStats();

  const [confusions, recent] = await Promise.all([
    prisma.categoryFeedback.groupBy({
      by: ["suggestedCategoryId", "chosenCategoryId"],
      _count: true,
      orderBy: { _count: { suggestedCategoryId: "desc" } },
      take: 15,
    }),
    prisma.categoryFeedback.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Catégorisation</h1>
        <p className="text-sm text-slate-500 mt-1">
          {stats.terms.toLocaleString("fr-FR")} termes · {stats.pairs.toLocaleString("fr-FR")} associations ·
          index construit depuis {stats.entries.toLocaleString("fr-FR")} exemples sur {stats.nodes} sous-catégories.
        </p>
      </header>

      <CategoryDebugger />

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
          Confusions les plus fréquentes
        </h2>
        {confusions.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Aucune correction enregistrée pour l&apos;instant. Cette liste se remplit quand un
            utilisateur choisit une catégorie différente de celle proposée.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Proposé", "Choisi", "Occurrences"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {confusions.map((c, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 font-mono text-xs">{c.suggestedCategoryId ?? "— aucune —"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold">{c.chosenCategoryId}</td>
                    <td className="px-4 py-2.5 tabular-nums">{c._count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
            Dernières corrections
          </h2>
          <ul className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
            {recent.map((f) => (
              <li key={f.id} className="px-4 py-3 text-sm">
                <span className="font-bold text-slate-900">{f.title}</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  proposé : {f.suggestedCategoryId ?? "rien"}
                  {f.suggestedSubcategory ? ` / ${f.suggestedSubcategory}` : ""}
                  {f.confidence !== null ? ` (${Math.round(f.confidence * 100)} %)` : ""} → choisi :{" "}
                  <strong>{f.chosenCategoryId}</strong>
                  {f.chosenSubcategory ? ` / ${f.chosenSubcategory}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

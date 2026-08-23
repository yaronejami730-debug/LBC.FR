import { prisma } from "@/lib/prisma";
import { ATTRIBUTION_KIND, attributionReport } from "@/lib/attribution";

export const metadata = { title: "Sondage d'acquisition — Deal&Co" };
export const dynamic = "force-dynamic";

const dateFr = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Résultats du sondage « Comment nous avez-vous connus ? ».
 *
 * ── Ce que cet écran refuse d'afficher ────────────────────────────────────
 *
 * Un pourcentage seul. Tant que les réponses se comptent sur les doigts, « 40 %
 * viennent de YouTube » veut dire « deux personnes sur cinq » — et une décision
 * budgétaire prise là-dessus serait une décision prise au hasard. Le nombre brut
 * accompagne donc systématiquement la part, et le taux de réponse est affiché en
 * tête.
 *
 * Rien n'est extrapolé aux personnes qui n'ont pas répondu : leur silence n'est
 * pas réparti au prorata des autres.
 */
export default async function AdminSondagePage() {
  const invited = await prisma.userEvent.count({ where: { kind: `${ATTRIBUTION_KIND}_SENT` } });
  const report = await attributionReport(invited || undefined);
  const max = Math.max(1, ...report.rows.map((r) => r.count));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2f6fb8]">Acquisition</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Comment nous ont-ils connus
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {report.answers === 0
            ? "Aucune réponse pour l'instant."
            : `${report.answers} réponse${report.answers > 1 ? "s" : ""}${
                report.responseRate !== null
                  ? ` sur ${report.invited} sollicitations, soit ${report.responseRate.toFixed(0)} %`
                  : ""
              }.`}
        </p>
      </header>

      {report.answers > 0 && report.answers < 30 && (
        <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
          Échantillon encore petit : {report.answers} réponses. Les parts affichées bougeront
          beaucoup à chaque nouvelle réponse — à lire comme une tendance, pas comme une mesure.
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {report.rows.map((row) => (
            <li key={row.key} className="px-5 py-4 flex items-center gap-4">
              <span className="w-64 shrink-0 text-sm font-bold text-slate-900">{row.label}</span>
              <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <span
                  className="block h-full rounded-full bg-[#2f6fb8]"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </span>
              <span className="w-28 shrink-0 text-right text-sm tabular-nums">
                <strong className="text-slate-900">{row.count}</strong>{" "}
                <span className="text-slate-400">
                  {report.answers > 0 ? `${row.share.toFixed(0)} %` : "—"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {report.freeText.length > 0 && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-extrabold text-[15px] text-slate-900">« Autrement » — en clair</h2>
            <p className="text-[12.5px] text-slate-500">
              C&apos;est ici qu&apos;apparaît la source à laquelle personne n&apos;avait pensé.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {report.freeText.map((f, i) => (
              <li key={i} className="px-5 py-3 flex items-baseline gap-3">
                <span className="text-sm text-slate-900 flex-1">{f.detail}</span>
                <span className="text-[11px] text-slate-400 shrink-0">{dateFr(f.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

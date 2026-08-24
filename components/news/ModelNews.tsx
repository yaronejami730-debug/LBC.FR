/**
 * Bloc « la presse en parle », posé sur les pages modèle et marque.
 *
 * ── Ce que ce bloc apporte, et pourquoi il vaut mieux qu'un article copié ──
 *
 * Il ne republie rien. Il montre trois titres datés, nomme le média qui les a
 * écrits, et renvoie chez lui. La valeur n'est pas dans le texte — il n'y en a
 * pas — elle est dans le **rapprochement** : cette page dit ce que vaut une
 * Clio d'occasion chez nous, et à côté, ce qui s'est écrit sur la Clio ce
 * mois-ci. Aucun des deux médias ne peut faire ça ; nous, si, parce que le
 * marché est notre matière.
 *
 * Ce que cela change pour l'indexation :
 *
 *   - la page **change** quand l'actualité change, sans qu'on l'édite ;
 *   - elle cite ses sources au lieu de les recopier, ce qui est exactement la
 *     différence entre une page utile et une page syndiquée ;
 *   - le visiteur qui compare un modèle y trouve un contexte qu'une grille de
 *     prix seule ne donne pas.
 *
 * ── Les liens sont suivis, volontairement ─────────────────────────────────
 *
 * Pas de `nofollow` : ces liens ne sont ni payés ni subis, ce sont des
 * citations. Les marquer comme non fiables reviendrait à dire qu'on cite une
 * source à laquelle on ne croit pas — et Google réserve `nofollow` aux liens
 * commerciaux ou non vérifiés, pas aux références.
 */

import { getNewsFor, type NewsCitation } from "@/lib/news/select";

function frDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default async function ModelNews({
  brandSlug,
  modelSlug = null,
  label,
}: {
  brandSlug: string;
  modelSlug?: string | null;
  /** Ce dont la page parle, tel qu'on l'écrit au visiteur : « Renault Clio ». */
  label: string;
}) {
  const items = await getNewsFor(brandSlug, modelSlug);

  // Rien de récent : pas de bloc. Un cadre vide coûte plus qu'il ne rapporte.
  if (items.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl border border-surface-container p-6 mt-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-bold text-on-surface">
          {/* Le titre suit ce qu'il y a réellement dans le bloc. Annoncer
              « actualité » au-dessus de trois essais de l'an dernier serait
              faux, et le visiteur le verrait à la première date. */}
          {items.every((i) => i.kind === "essai")
            ? `${label} : essais et guides de la presse`
            : `${label} : ce que dit la presse`}
        </h2>
        <span className="shrink-0 text-xs text-outline">Mis à jour deux fois par jour</span>
      </div>

      <p className="mt-1 text-sm text-on-surface-variant">
        Essais et actualités publiés par la presse spécialisée. Deal&amp;Co n&apos;en
        reprend que le titre, avec sa date, et renvoie vers l&apos;article
        d&apos;origine.
      </p>

      <ul className="mt-4 space-y-3">
        {items.map((item: NewsCitation) => (
          <li key={item.url} className="border-t border-surface-container pt-3 first:border-t-0 first:pt-0">
            <a
              href={item.url}
              target="_blank"
              rel="noopener"
              className="text-sm font-semibold text-on-surface hover:text-primary hover:underline"
            >
              {item.title}
            </a>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-outline">
              <span>{item.publisher}</span>
              <span aria-hidden>·</span>
              <span>{item.kind === "essai" ? "essai" : "actualité"}</span>
              <span aria-hidden>·</span>
              <time dateTime={item.publishedAt.toISOString()}>{frDate(item.publishedAt)}</time>
              {!item.exact && (
                <>
                  <span aria-hidden>·</span>
                  {/* Dire que l'article parle de la marque et pas du modèle
                      évite de laisser croire qu'il traite précisément la page. */}
                  <span>actualité de la marque</span>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

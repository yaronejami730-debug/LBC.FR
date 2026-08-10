import Link from "next/link";
import type { ProModule } from "@/lib/pro/modules";
import EstablishmentSwitcher, { type SwitcherEstablishment } from "./EstablishmentSwitcher";

/**
 * Navigation de l'espace professionnel.
 *
 * Les onglets ne sont plus une liste en dur : ils viennent de `modulesFor()`,
 * dérivé des capacités de l'établissement. Un dépôt-vente automobile n'a donc
 * jamais d'onglet « Prestations », et un salon de coiffure jamais d'onglet
 * « Véhicules » — sans qu'aucune condition métier n'existe ici.
 *
 * Le lien vers la fiche publique reste : le professionnel n'avait aucun moyen
 * d'atteindre sa propre page depuis son back-office.
 */
export default function ProNav({
  current,
  slug,
  modules,
  establishments = [],
  activeEstablishmentId,
  canBook = false,
}: {
  current: string;
  slug?: string | null;
  modules: ProModule[];
  establishments?: SwitcherEstablishment[];
  activeEstablishmentId?: string;
  /** Le lien « Tester la réservation » n'a de sens que si elle est ouverte. */
  canBook?: boolean;
}) {
  return (
    <div className="mb-5 space-y-3">
      {establishments.length > 1 && activeEstablishmentId && (
        <EstablishmentSwitcher establishments={establishments} activeId={activeEstablishmentId} />
      )}

      <nav className="flex gap-1.5 overflow-x-auto no-scrollbar" aria-label="Espace professionnel">
        {modules.map((module) => {
          const active = module.href === current;
          return (
            <Link
              key={module.id}
              href={module.href}
              title={module.label}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                active
                  ? "bg-primary text-white"
                  : "bg-white border border-slate-100 text-on-surface-variant hover:border-primary hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{module.icon}</span>
              {module.label}
            </Link>
          );
        })}
      </nav>

      {slug && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/pro/${slug}`}
            title="Voir ma page publique"
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-primary"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            Voir ma page publique
          </Link>
          {canBook && (
            <Link
              href={`/pro/${slug}/reserver`}
              title="Tester le parcours de réservation"
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-primary"
            >
              <span className="material-symbols-outlined text-[16px]">event_available</span>
              Tester la réservation
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
